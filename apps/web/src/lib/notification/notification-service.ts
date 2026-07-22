import {
  NotificationRecordStatus,
  OutboundChannel,
  ShortLinkScene,
  prisma,
} from "@connectiq/database";
import { BillingLedgerResource } from "@connectiq/database";
import { tryDebitInviteCredit } from "@/lib/billing/billing-guards";
import { creditOrgWallet } from "@/lib/billing/wallet-service";
import { routeChannelSend } from "@/lib/notification/channel-router";
import {
  assertUserWithinQuota,
  incrementQuota,
  isActivationTemplate,
  isOptedOut,
  isUserActivatedOnEvent,
  isWithinSendWindow,
} from "@/lib/notification/compliance";
import { encryptRecipient } from "@/lib/notification/crypto";
import { resolveUserIdentity } from "@/lib/notification/identity-resolver";
import {
  assertShortNameValid,
  buildHonorific,
  renderTemplate,
} from "@/lib/notification/render";
import { createShortLink } from "@/lib/notification/short-link-service";
import type { NotifyPayload } from "@/lib/notification/types";

function appBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://9li.co/uc"
  );
}

export async function notifyUser(input: {
  userId: string;
  templateCode: string;
  payload?: NotifyPayload;
  eventId: string;
  jobId?: string;
  /** verify 类可跳过时段限制 */
  skipSendWindow?: boolean;
  skipQuota?: boolean;
  /** 目标落地（会生成短链） */
  targetUrl?: string;
  shortLinkScene?: ShortLinkScene;
  orgId?: string;
  debitWallet?: boolean;
}): Promise<{
  recordId: string;
  success: boolean;
  error?: string;
  shortUrl?: string;
}> {
  const template = await prisma.notificationTemplate.findUnique({
    where: { code: input.templateCode },
  });
  if (!template || !template.enabled) {
    throw new Error(`模板不存在或未启用: ${input.templateCode}`);
  }

  if (
    template.category === "MARKETING" &&
    !input.skipSendWindow &&
    !isWithinSendWindow()
  ) {
    return {
      recordId: "",
      success: false,
      error: "营销类通知仅可在 08:00–21:00（北京时间）发送",
    };
  }

  const event = await prisma.event.findUnique({
    where: { id: input.eventId },
    select: {
      id: true,
      name: true,
      shortName: true,
      location: true,
      startDate: true,
      orgId: true,
      org: { select: { contactEmail: true, name: true } },
    },
  });
  if (!event) throw new Error("活动不存在");

  if (template.channel === OutboundChannel.SMS) {
    assertShortNameValid(event.shortName);
  }

  if (isActivationTemplate(input.templateCode)) {
    if (await isUserActivatedOnEvent(input.eventId, input.userId)) {
      return {
        recordId: "",
        success: false,
        error: "激活类通知自动排除已启用用户",
      };
    }
  }

  if (!input.skipQuota) {
    const q = await assertUserWithinQuota({
      eventId: input.eventId,
      userId: input.userId,
      channel: template.channel,
      templateCode: input.templateCode,
    });
    if (!q.ok) {
      return { recordId: "", success: false, error: q.reason };
    }
  }

  const identity = await resolveUserIdentity(input.userId);
  if (!identity) throw new Error("用户不存在");

  const recipient =
    template.channel === OutboundChannel.SMS
      ? identity.phone
      : template.channel === OutboundChannel.EMAIL
        ? identity.email
        : null;

  if (!recipient) {
    return {
      recordId: "",
      success: false,
      error:
        template.channel === OutboundChannel.SMS
          ? "用户无手机号"
          : "用户无邮箱",
    };
  }

  const identityType =
    template.channel === OutboundChannel.SMS ? "phone" : "email";
  if (
    await isOptedOut({
      identityType,
      identityValue: recipient,
      eventId: input.eventId,
    })
  ) {
    return { recordId: "", success: false, error: "已退订" };
  }

  let shortUrl: string | undefined;
  let shortLinkId: string | undefined;
  const target =
    input.targetUrl ||
    `${appBaseUrl()}/events/${input.eventId}`;

  if (
    template.body.includes("{短链}") ||
    template.body.includes("{完整链接}") ||
    input.targetUrl
  ) {
    const scene =
      input.shortLinkScene ??
      (template.audience === "EXHIBITOR"
        ? ShortLinkScene.B
        : template.audience === "ORGANIZER"
          ? ShortLinkScene.O
          : ShortLinkScene.A);
    const link = await createShortLink({
      scene,
      targetUrl: /^https:\/\//i.test(target)
        ? target
        : `https://9li.co${target.startsWith("/") ? "" : "/"}${target}`,
      eventId: input.eventId,
      userId: input.userId,
    });
    shortUrl = link.url;
    shortLinkId = link.id;
  }

  const openDate = event.startDate
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        month: "numeric",
        day: "numeric",
      }).format(event.startDate)
    : "";

  const vars: Record<string, string | number | undefined> = {
    姓氏称谓: buildHonorific(identity.name),
    活动全称: event.name,
    活动简称: event.shortName ?? event.name.slice(0, 8),
    开幕日期: openDate,
    活动地点: event.location ?? "",
    短链: shortUrl?.replace(/^https?:\/\//, "") ?? "",
    完整链接: shortUrl ?? target,
    退订链接: `${appBaseUrl()}/optout?event=${input.eventId}`,
    ...Object.fromEntries(
      Object.entries(input.payload ?? {}).map(([k, v]) => [
        k,
        v == null ? "" : String(v),
      ]),
    ),
  };

  const renderedBody = renderTemplate(template.body, vars);
  const renderedSubject = template.subject
    ? renderTemplate(template.subject, vars)
    : null;

  if (
    template.requiresOptOut &&
    template.channel === OutboundChannel.SMS &&
    !renderedBody.includes("回T退订")
  ) {
    throw new Error("营销短信模板必须包含「回T退订」");
  }

  const orgId = input.orgId ?? event.orgId;

  if (input.debitWallet !== false && template.category !== "VERIFY") {
    const debit = await tryDebitInviteCredit({
      orgId,
      channel: template.channel === OutboundChannel.SMS ? "SMS" : "EMAIL",
      eventId: input.eventId,
    });
    if (!debit.ok) {
      return { recordId: "", success: false, error: debit.error };
    }
  }

  const record = await prisma.notificationRecord.create({
    data: {
      jobId: input.jobId,
      eventId: input.eventId,
      userId: input.userId,
      templateCode: input.templateCode,
      channel: template.channel,
      recipientCipher: encryptRecipient(recipient),
      renderedBody,
      renderedSubject,
      status: NotificationRecordStatus.PENDING,
      shortLinkId,
    },
  });

  const send = await routeChannelSend({
    channel: template.channel,
    recipient,
    subject: renderedSubject,
    body: renderedBody,
    tag: record.id,
    variables: {
      notification_record_id: record.id,
      event_id: input.eventId,
      template_code: input.templateCode,
    },
    fromDisplayName: `${event.name}组委会 (via 玖莅)`,
    replyTo: event.org.contactEmail ?? undefined,
  });

  if (send.success) {
    await prisma.notificationRecord.update({
      where: { id: record.id },
      data: {
        status: NotificationRecordStatus.SENT,
        sentAt: new Date(),
        providerMsgId: send.messageId?.replace(/^<|>$/g, ""),
      },
    });
    if (!input.skipQuota) {
      await incrementQuota(input.eventId, input.userId, template.channel);
    }
    return {
      recordId: record.id,
      success: true,
      shortUrl,
    };
  }

  await prisma.notificationRecord.update({
    where: { id: record.id },
    data: {
      status: NotificationRecordStatus.FAILED,
      errorCode: send.error ?? "SEND_FAILED",
    },
  });

  // 失败退回额度（非 verify）
  if (input.debitWallet !== false && template.category !== "VERIFY") {
    try {
      await creditOrgWallet({
        orgId,
        resource:
          template.channel === OutboundChannel.SMS
            ? BillingLedgerResource.SMS
            : BillingLedgerResource.EMAIL,
        amount: 1,
        eventId: input.eventId,
        remark: "通知发送失败退回",
      });
    } catch {
      /* ignore refund failure */
    }
  }

  return {
    recordId: record.id,
    success: false,
    error: send.error,
    shortUrl,
  };
}

/**
 * @deprecated 登录验证码请用 `@/lib/sms` 的 `sendVerificationSms`（请求内直发）。
 * 勿经 NotificationJob / 邀请队列。保留此函数仅兼容旧调用。
 */
export async function notifyVerificationSms(input: {
  phone: string;
  code: string;
  userId?: string;
  eventId: string;
}) {
  const { sendVerificationSms } = await import("@/lib/sms");
  const result = await sendVerificationSms(input.phone, input.code);
  return {
    success: result.sent,
    error: result.error,
    provider: result.dev ? "dev" : undefined,
  };
}
