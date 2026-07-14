import {
  InviteChannel,
  InviteCampaignStatus,
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

const BATCH_SIZE = 30;
const MAX_BATCHES_PER_RUN = 40;
/** SENDING 超过此时长未落终态则回收为 PENDING，避免卡死 */
const STUCK_SENDING_MS = 5 * 60 * 1000;
const DELAY_MS: Record<InviteChannel, number> = {
  SMS: 80,
  EMAIL: 30,
  WECHAT: 50,
};

type RecordWithRelations = Awaited<
  ReturnType<typeof loadRecordsByIds>
>[number];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function loadRecordsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return prisma.inviteRecord.findMany({
    where: { id: { in: ids }, status: InviteRecordStatus.SENDING },
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

/** 回收超时的 SENDING，防止进程崩溃导致永久卡住 */
export async function recoverStuckSendingRecords(campaignId?: string) {
  const cutoff = new Date(Date.now() - STUCK_SENDING_MS);
  const result = await prisma.inviteRecord.updateMany({
    where: {
      status: InviteRecordStatus.SENDING,
      updatedAt: { lt: cutoff },
      ...(campaignId ? { campaignId } : {}),
    },
    data: {
      status: InviteRecordStatus.PENDING,
      errorMessage: "发送超时已回收，等待重试",
    },
  });
  return result.count;
}

/**
 * 乐观锁 claim：逐条 PENDING → SENDING，只有 update 成功的才发送。
 */
async function claimPendingBatch(campaignId: string): Promise<string[]> {
  const candidates = await prisma.inviteRecord.findMany({
    where: { campaignId, status: InviteRecordStatus.PENDING },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  const claimed: string[] = [];
  for (const row of candidates) {
    const updated = await prisma.inviteRecord.updateMany({
      where: { id: row.id, status: InviteRecordStatus.PENDING },
      data: {
        status: InviteRecordStatus.SENDING,
        errorMessage: null,
      },
    });
    if (updated.count === 1) claimed.push(row.id);
  }
  return claimed;
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
  if (
    !isAliyunSmsConfigured("ALIYUN_SMS_INVITE_TEMPLATE_CODE") &&
    !isAliyunSmsConfigured()
  ) {
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
    variables: {
      invite_record_id: record.id,
      campaign_id: record.campaignId,
    },
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

async function markRecordResult(
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
          vendorMessageId: result.messageId
            ? result.messageId.replace(/^<|>$/g, "")
            : undefined,
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

async function processClaimedRecords(
  records: RecordWithRelations[],
  orgId: string | null | undefined,
  eventId: string,
) {
  for (const record of records) {
    try {
      if (
        orgId &&
        (record.channel === InviteChannel.SMS ||
          record.channel === InviteChannel.EMAIL)
      ) {
        const { tryDebitInviteCredit } = await import(
          "@/lib/billing/billing-guards"
        );
        const debit = await tryDebitInviteCredit({
          orgId,
          channel: record.channel,
          eventId,
        });
        if (!debit.ok) {
          await markRecordResult(record.id, record.participantId, {
            success: false,
            error: debit.error,
          });
          continue;
        }
      }

      const result = await dispatchRecord(record);
      await markRecordResult(record.id, record.participantId, result);

      if (
        !result.success &&
        orgId &&
        (record.channel === InviteChannel.SMS ||
          record.channel === InviteChannel.EMAIL)
      ) {
        const { creditOrgWallet } = await import(
          "@/lib/billing/wallet-service"
        );
        const { BillingLedgerResource } = await import("@connectiq/database");
        await creditOrgWallet({
          orgId,
          resource:
            record.channel === InviteChannel.SMS
              ? BillingLedgerResource.SMS
              : BillingLedgerResource.EMAIL,
          amount: 1,
          eventId,
          remark: "邀请发送失败退回额度",
        }).catch((err) => console.warn("[invite] refund credit failed", err));
      }

      await sleep(DELAY_MS[record.channel] ?? 30);
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
}

/** 处理单个 campaign 的待发队列（可被 API 立即触发，也可被 Cron 调用） */
export async function processSendQueue(campaignId: string) {
  const campaign = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
  });
  if (!campaign) return { processed: 0 };

  if (campaign.scheduledAt && campaign.scheduledAt.getTime() > Date.now()) {
    return { processed: 0, scheduled: true as const };
  }

  if (
    campaign.status === InviteCampaignStatus.SCHEDULED &&
    (!campaign.scheduledAt || campaign.scheduledAt.getTime() <= Date.now())
  ) {
    await prisma.inviteCampaign.update({
      where: { id: campaignId },
      data: {
        status: InviteCampaignStatus.SENDING,
        startedAt: campaign.startedAt ?? new Date(),
      },
    });
  }

  await recoverStuckSendingRecords(campaignId);

  const eventOrg = await prisma.event.findUnique({
    where: { id: campaign.eventId },
    select: { orgId: true },
  });

  let processed = 0;
  for (let i = 0; i < MAX_BATCHES_PER_RUN; i += 1) {
    const claimedIds = await claimPendingBatch(campaignId);
    if (claimedIds.length === 0) break;

    const records = await loadRecordsByIds(claimedIds);
    await processClaimedRecords(records, eventOrg?.orgId, campaign.eventId);
    processed += records.length;
    await refreshCampaignStats(campaignId);
  }

  await refreshCampaignStats(campaignId);
  return { processed };
}

/**
 * Cron 入口：回收卡住的 SENDING，并推进所有到期/进行中的 campaign。
 */
export async function processDueInviteCampaigns(options?: {
  maxCampaigns?: number;
}) {
  const maxCampaigns = options?.maxCampaigns ?? 20;
  const recovered = await recoverStuckSendingRecords();
  const now = new Date();

  const campaigns = await prisma.inviteCampaign.findMany({
    where: {
      OR: [
        { status: InviteCampaignStatus.SENDING },
        {
          status: InviteCampaignStatus.SCHEDULED,
          scheduledAt: { lte: now },
        },
      ],
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: maxCampaigns,
  });

  const results: { campaignId: string; processed: number }[] = [];
  for (const c of campaigns) {
    const r = await processSendQueue(c.id);
    results.push({ campaignId: c.id, processed: r.processed });
  }

  return { recovered, campaigns: results.length, results };
}
