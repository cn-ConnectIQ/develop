import {
  InviteRecordStatus,
  ParticipantInviteStatus,
  prisma,
} from "@connectiq/database";
import { refreshCampaignStats } from "@/lib/invite/service";

function normalizeMessageId(id: string | null | undefined) {
  if (!id) return null;
  return id.replace(/^<|>$/g, "").trim();
}

/**
 * 按 vendorMessageId 或 recordId 回写送达/失败/打开/点击。
 */
export async function applyInviteDeliveryEvent(input: {
  recordId?: string | null;
  vendorMessageId?: string | null;
  event:
    | "delivered"
    | "failed"
    | "opened"
    | "clicked"
    | "permanently_failed"
    | "complained";
  errorMessage?: string | null;
}) {
  const vendorId = normalizeMessageId(input.vendorMessageId);
  const record = input.recordId
    ? await prisma.inviteRecord.findUnique({ where: { id: input.recordId } })
    : vendorId
      ? await prisma.inviteRecord.findFirst({
          where: {
            OR: [
              { vendorMessageId: vendorId },
              { vendorMessageId: `<${vendorId}>` },
            ],
          },
        })
      : null;

  if (!record) return { updated: false as const };

  const now = new Date();
  let nextStatus = record.status;
  const data: {
    status?: InviteRecordStatus;
    deliveredAt?: Date;
    clickedAt?: Date;
    errorMessage?: string | null;
    vendorMessageId?: string;
  } = {};

  switch (input.event) {
    case "delivered":
      if (
        record.status === InviteRecordStatus.SENT ||
        record.status === InviteRecordStatus.SENDING ||
        record.status === InviteRecordStatus.PENDING
      ) {
        nextStatus = InviteRecordStatus.DELIVERED;
        data.status = nextStatus;
        data.deliveredAt = now;
      }
      break;
    case "opened":
    case "clicked":
      if (
        record.status !== InviteRecordStatus.ACTIVATED &&
        record.status !== InviteRecordStatus.CLICKED
      ) {
        nextStatus = InviteRecordStatus.CLICKED;
        data.status = nextStatus;
        data.clickedAt = now;
        if (!record.deliveredAt) data.deliveredAt = now;
      } else if (!record.clickedAt) {
        data.clickedAt = now;
      }
      break;
    case "failed":
    case "permanently_failed":
    case "complained":
      if (
        record.status === InviteRecordStatus.PENDING ||
        record.status === InviteRecordStatus.SENDING ||
        record.status === InviteRecordStatus.SENT
      ) {
        nextStatus = InviteRecordStatus.FAILED;
        data.status = nextStatus;
        data.errorMessage =
          input.errorMessage?.slice(0, 500) ||
          (input.event === "complained" ? "收件人投诉/标记垃圾邮件" : "投递失败");
      }
      break;
  }

  if (vendorId && !record.vendorMessageId) {
    data.vendorMessageId = vendorId;
  }

  if (Object.keys(data).length === 0) {
    return { updated: false as const, recordId: record.id };
  }

  await prisma.inviteRecord.update({
    where: { id: record.id },
    data,
  });

  if (
    nextStatus === InviteRecordStatus.CLICKED ||
    nextStatus === InviteRecordStatus.DELIVERED
  ) {
    await prisma.participant.updateMany({
      where: {
        id: record.participantId,
        inviteStatus: {
          in: [
            ParticipantInviteStatus.NOT_INVITED,
            ParticipantInviteStatus.INVITED,
          ],
        },
      },
      data: {
        inviteStatus:
          nextStatus === InviteRecordStatus.CLICKED
            ? ParticipantInviteStatus.CLICKED
            : ParticipantInviteStatus.INVITED,
      },
    });
  }

  await refreshCampaignStats(record.campaignId);
  return { updated: true as const, recordId: record.id, status: nextStatus };
}
