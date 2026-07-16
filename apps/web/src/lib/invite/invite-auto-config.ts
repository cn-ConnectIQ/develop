import { InviteChannel, prisma } from "@connectiq/database";

export const INVITE_AUTO_SETTING_KEY = "invite_auto_on_participant";

export type InviteAutoConfig = {
  /** 新参会者加入时是否自动发送固定模板邀请 */
  enabled: boolean;
  /** 新展商工作人员加入展位时是否自动发送固定模板邀请 */
  autoOnBoothStaff: boolean;
  /**
   * 发送渠道：
   * - SMS：优先短信（无手机则跳过）
   * - EMAIL：优先邮件（无邮箱则跳过）
   * - AUTO：有手机用短信，否则邮件
   */
  channel: "SMS" | "EMAIL" | "AUTO";
};

export const DEFAULT_INVITE_AUTO_CONFIG: InviteAutoConfig = {
  enabled: false,
  autoOnBoothStaff: false,
  channel: "AUTO",
};

function parseConfig(raw: unknown): InviteAutoConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_INVITE_AUTO_CONFIG };
  }
  const obj = raw as Record<string, unknown>;
  const channel =
    obj.channel === "SMS" || obj.channel === "EMAIL" || obj.channel === "AUTO"
      ? obj.channel
      : DEFAULT_INVITE_AUTO_CONFIG.channel;
  return {
    enabled: Boolean(obj.enabled),
    // 旧配置无该字段时：跟随 enabled，避免老活动需重开
    autoOnBoothStaff:
      typeof obj.autoOnBoothStaff === "boolean"
        ? obj.autoOnBoothStaff
        : Boolean(obj.enabled),
    channel,
  };
}

export async function getInviteAutoConfig(
  eventId: string,
): Promise<InviteAutoConfig> {
  const row = await prisma.eventSetting.findUnique({
    where: {
      eventId_key: { eventId, key: INVITE_AUTO_SETTING_KEY },
    },
    select: { value: true },
  });
  return parseConfig(row?.value);
}

export async function setInviteAutoConfig(
  eventId: string,
  patch: Partial<InviteAutoConfig>,
): Promise<InviteAutoConfig> {
  const current = await getInviteAutoConfig(eventId);
  const next: InviteAutoConfig = {
    enabled:
      typeof patch.enabled === "boolean" ? patch.enabled : current.enabled,
    autoOnBoothStaff:
      typeof patch.autoOnBoothStaff === "boolean"
        ? patch.autoOnBoothStaff
        : current.autoOnBoothStaff,
    channel: patch.channel ?? current.channel,
  };

  await prisma.eventSetting.upsert({
    where: {
      eventId_key: { eventId, key: INVITE_AUTO_SETTING_KEY },
    },
    create: {
      eventId,
      key: INVITE_AUTO_SETTING_KEY,
      value: next,
    },
    update: { value: next },
  });

  return next;
}

export function resolveInviteChannelForParticipant(
  preferred: InviteAutoConfig["channel"],
  contact: { phone?: string | null; email?: string | null },
): InviteChannel | null {
  const hasPhone = Boolean(contact.phone?.trim());
  const hasEmail = Boolean(contact.email?.trim());

  if (preferred === "SMS") return hasPhone ? InviteChannel.SMS : null;
  if (preferred === "EMAIL") return hasEmail ? InviteChannel.EMAIL : null;

  if (hasPhone) return InviteChannel.SMS;
  if (hasEmail) return InviteChannel.EMAIL;
  return null;
}
