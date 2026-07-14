import {
  InviteChannel,
  InviteRecordStatus,
  ParticipantInviteStatus,
  prisma,
} from "@connectiq/database";
import { sendInviteEmail } from "@/lib/email";
import {
  buildActivationLink,
  formatEventDate,
  resolveInviteMessage,
} from "@/lib/invite/message";
import { refreshCampaignStats } from "@/lib/invite/service";
import { sendWechatTemplate } from "@/lib/wechat-template";

const BATCH_SIZE = 50;

type RecordWithRelations = Awaited<
  ReturnType<typeof loadPendingBatch>
>[number];

async function loadPendingBatch(campaignId: string) {
  return prisma.inviteRecord.findMany({
    where: { campaignId, status: InviteRecordStatus.PENDING },
    take: BATCH_SIZE,
    include: {
      participant: true,
      campaign: {
        include: {
          event: {
            select: {
              id: true,
              name: true,
              location: true,
              startDate: true,
              organizer: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

function buildMessageContext(record: RecordWithRelations) {
  const event = record.campaign.event;
  const link = buildActivationLink(record.activationToken, event.id);
  return {
    name: record.participant.name,
    eventName: event.name,
    eventDate: formatEventDate(event.startDate),
    link,
    organizer: event.organizer.name,
    location: event.location ?? "",
  };
}

export async function sendSMS(
  destination: string,
  message: string,
  templateParam?: Record<string, string>,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { isAliyunSmsConfigured, sendAliyunSms } = await import(
    "@/lib/aliyun-sms"
  );
  if (!isAliyunSmsConfigured("ALIYUN_SMS_INVITE_TEMPLATE_CODE") &&
      !isAliyunSmsConfigured()) {
    console.info("[SMS DEV]", { destination, message });
    return { success: true, messageId: `dev-sms-${Date.now()}` };
  }

  const inviteTemplate = process.env.ALIYUN_SMS_INVITE_TEMPLATE_CODE?.trim();
  return sendAliyunSms({
    phone: destination,
    templateEnv: inviteTemplate
      ? "ALIYUN_SMS_INVITE_TEMPLATE_CODE"
      : undefined,
    templateCode: inviteTemplate || undefined,
    templateParam: templateParam ?? {
      name: "嘉宾",
      event: message.slice(0, 20),
    },
  });
}

export async function sendEmail(
  record: RecordWithRelations,
  subject: string,
  plainText: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const ctx = buildMessageContext(record);
  const result = await sendInviteEmail({
    to: record.destination,
    subject,
    participantName: ctx.name,
    eventName: ctx.eventName,
    eventDate: ctx.eventDate,
    eventLocation: ctx.location,
    organizerName: ctx.organizer,
    activationLink: ctx.link,
    plainText,
  });
  return {
    success: result.sent,
    messageId: result.messageId,
    error: result.error,
  };
}

export async function sendWechatTemplateMessage(
  record: RecordWithRelations,
  templateId: string,
) {
  const ctx = buildMessageContext(record);
  return sendWechatTemplate({
    openId: record.destination,
    templateId,
    url: ctx.link,
    data: {
      thing1: { value: ctx.eventName.slice(0, 20) },
      time2: { value: ctx.eventDate },
      thing3: { value: ctx.name.slice(0, 20) },
    },
  });
}

async function dispatchRecord(record: RecordWithRelations) {
  const template = record.campaign.customMessage ?? "";
  const ctx = buildMessageContext(record);
  const message = resolveInviteMessage(template, ctx);

  switch (record.channel) {
    case InviteChannel.SMS:
      return sendSMS(record.destination, message, {
        name: ctx.name.slice(0, 20),
        event: ctx.eventName.slice(0, 20),
      });
    case InviteChannel.EMAIL:
      return sendEmail(
        record,
        record.campaign.subject ?? `您已受邀参加 ${ctx.eventName}`,
        message,
      );
    case InviteChannel.WECHAT:
      return sendWechatTemplateMessage(
        record,
        record.campaign.templateId ?? "default_invite",
      );
    default:
      return { success: false, error: "未知渠道" };
  }
}

async function markRecordSent(
  recordId: string,
  participantId: string,
  result: { success: boolean; messageId?: string; error?: string },
) {
  if (result.success) {
    await prisma.$transaction([
      prisma.inviteRecord.update({
        where: { id: recordId },
        data: {
          status: InviteRecordStatus.SENT,
          sentAt: new Date(),
          vendorMessageId: result.messageId,
          errorMessage: null,
        },
      }),
      prisma.participant.updateMany({
        where: {
          id: participantId,
          inviteStatus: ParticipantInviteStatus.NOT_INVITED,
        },
        data: { inviteStatus: ParticipantInviteStatus.INVITED },
      }),
    ]);
    return;
  }

  await prisma.inviteRecord.update({
    where: { id: recordId },
    data: {
      status: InviteRecordStatus.FAILED,
      errorMessage: result.error ?? "发送失败",
    },
  });
}

export async function processSendQueue(campaignId: string) {
  const campaign = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
  });

  if (!campaign) return;

  if (campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now()) {
    return;
  }

  let batch = await loadPendingBatch(campaignId);

  const eventOrg = await prisma.event.findUnique({
    where: { id: campaign.eventId },
    select: { orgId: true },
  });

  while (batch.length > 0) {
    for (const record of batch) {
      try {
        if (
          eventOrg?.orgId &&
          (record.channel === InviteChannel.SMS ||
            record.channel === InviteChannel.EMAIL)
        ) {
          const { tryDebitInviteCredit } = await import(
            "@/lib/billing/billing-guards"
          );
          const debit = await tryDebitInviteCredit({
            orgId: eventOrg.orgId,
            channel: record.channel,
            eventId: campaign.eventId,
          });
          if (!debit.ok) {
            await markRecordSent(record.id, record.participantId, {
              success: false,
              error: debit.error,
            });
            continue;
          }
        }

        const result = await dispatchRecord(record);
        await markRecordSent(record.id, record.participantId, result);

        // 发送失败时退回额度
        if (
          !result.success &&
          eventOrg?.orgId &&
          (record.channel === InviteChannel.SMS ||
            record.channel === InviteChannel.EMAIL)
        ) {
          const { creditOrgWallet } = await import(
            "@/lib/billing/wallet-service"
          );
          const { BillingLedgerResource } = await import("@connectiq/database");
          await creditOrgWallet({
            orgId: eventOrg.orgId,
            resource:
              record.channel === InviteChannel.SMS
                ? BillingLedgerResource.SMS
                : BillingLedgerResource.EMAIL,
            amount: 1,
            eventId: campaign.eventId,
            remark: "邀请发送失败退回额度",
          }).catch((err) =>
            console.warn("[invite] refund credit failed", err),
          );
        }
      } catch (error) {
        await prisma.inviteRecord.update({
          where: { id: record.id },
          data: {
            status: InviteRecordStatus.FAILED,
            errorMessage:
              error instanceof Error ? error.message : "发送异常",
          },
        });
      }
    }

    await refreshCampaignStats(campaignId);
    batch = await loadPendingBatch(campaignId);
  }

  await refreshCampaignStats(campaignId);
}
