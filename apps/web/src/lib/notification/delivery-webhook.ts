import { NotificationRecordStatus, prisma } from "@connectiq/database";
import { addOptOut } from "@/lib/notification/compliance";

/** 按 notification_record id 或 provider_msg_id 回写投递状态 */
export async function applyNotificationDeliveryEvent(input: {
  recordId?: string | null;
  providerMsgId?: string | null;
  event: "delivered" | "failed" | "clicked" | "bounced";
  errorCode?: string | null;
}) {
  const where = input.recordId
    ? { id: input.recordId }
    : input.providerMsgId
      ? { providerMsgId: input.providerMsgId.replace(/^<|>$/g, "") }
      : null;
  if (!where) return { updated: false };

  const data: Record<string, unknown> = {};
  if (input.event === "delivered") {
    data.status = NotificationRecordStatus.DELIVERED;
    data.deliveredAt = new Date();
  } else if (input.event === "failed" || input.event === "bounced") {
    data.status =
      input.event === "bounced"
        ? NotificationRecordStatus.BOUNCED
        : NotificationRecordStatus.FAILED;
    data.errorCode = input.errorCode ?? input.event;
  } else if (input.event === "clicked") {
    data.clickedAt = new Date();
  }

  const result = await prisma.notificationRecord.updateMany({
    where,
    data,
  });
  return { updated: result.count > 0 };
}

export async function handleSmsOptOutReply(phone: string, content: string) {
  const normalized = content.replace(/\s+/g, "").toUpperCase();
  if (
    normalized === "T" ||
    normalized === "TD" ||
    normalized.includes("退订") ||
    normalized === "R"
  ) {
    await addOptOut({
      identityType: "phone",
      identityValue: phone,
      scope: "GLOBAL",
      source: "SMS_REPLY",
    });
    return true;
  }
  return false;
}
