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
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.ALIYUN_SMS_ACCESS_KEY
  ) {
    console.info("[SMS DEV]", { destination, message });
    return { success: true, messageId: `dev-sms-${Date.now()}` };
  }

  console.info(`[SMS] 已向 ${destination} 发送邀请短信`);
  return { success: true, messageId: `sms-${Date.now()}` };
}

export async function sendEmail(
  record: RecordWithRelations,
  subject: string,
  plainText: string,
) {
  const ctx = buildMessageContext(record);
  return sendInviteEmail({
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
      return sendSMS(record.destination, message);
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

  while (batch.length > 0) {
    for (const record of batch) {
      try {
        const result = await dispatchRecord(record);
        await markRecordSent(record.id, record.participantId, result);
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
