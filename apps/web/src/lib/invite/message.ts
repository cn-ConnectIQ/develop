import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { buildInviteShortUrl } from "@/lib/invite/invite-url";

export { buildInviteShortUrl };

export type InviteMessageContext = {
  name: string;
  eventName: string;
  eventDate: string;
  link: string;
  organizer: string;
  location?: string;
};

/** 短信/邮件激活链接：自有短链 https://9li.co/a/{token} */
export function buildActivationLink(token: string, _eventId?: string) {
  return buildInviteShortUrl(token);
}

export function formatEventDate(date: Date | null | undefined) {
  if (!date) return "日期待定";
  return format(date, "yyyy年M月d日", { locale: zhCN });
}

/** 起止日期展示：同日只显示一天，跨日显示区间 */
export function formatEventDateRange(
  start: Date | null | undefined,
  end?: Date | null | undefined,
) {
  if (!start) return "日期待定";
  const startLabel = format(start, "yyyy年M月d日", { locale: zhCN });
  if (!end) return startLabel;
  const sameDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameDay) return startLabel;
  const endLabel = format(end, "yyyy年M月d日", { locale: zhCN });
  return `${startLabel} – ${endLabel}`;
}

/**
 * 统一占位符（三通道共用）。
 * 支持 `{name}` / `{{name}}`，以及 camelCase / snake_case 别名。
 */
export function resolveInviteMessage(
  template: string,
  ctx: InviteMessageContext,
): string {
  const location = ctx.location ?? "";
  const pairs: Array<[string, string]> = [
    ["name", ctx.name],
    ["event_name", ctx.eventName],
    ["eventName", ctx.eventName],
    ["event_date", ctx.eventDate],
    ["eventDate", ctx.eventDate],
    ["link", ctx.link],
    ["activation_link", ctx.link],
    ["organizer", ctx.organizer],
    ["location", location],
    ["event_location", location],
    ["eventLocation", location],
  ];

  let out = template;
  for (const [key, value] of pairs) {
    out = out.replaceAll(`{${key}}`, value);
    out = out.replaceAll(`{{${key}}}`, value);
  }
  return out;
}

/**
 * 临时关闭邀请 token 有效期校验（测试联调）。
 * 恢复：改为 true，并确认下方 computeTokenExpiresAt 策略。
 */
export const INVITE_TOKEN_EXPIRY_ENFORCED = false;

/** 是否因时间过期（未开启强制时恒为 false） */
export function isInviteTokenTimeExpired(
  expiresAt: Date | null | undefined,
): boolean {
  if (!INVITE_TOKEN_EXPIRY_ENFORCED) return false;
  if (!expiresAt) return false;
  return expiresAt.getTime() <= Date.now();
}

/** 写入 DB 的过期时间；未强制校验时仍写远未来，避免字段为空 */
export function computeTokenExpiresAt(eventEndDate: Date | null | undefined) {
  if (!INVITE_TOKEN_EXPIRY_ENFORCED) {
    return new Date("2099-12-31T23:59:59.000Z");
  }
  const base = eventEndDate ?? new Date();
  const expires = new Date(base);
  expires.setDate(expires.getDate() + 7);
  return expires;
}

/**
 * 参会者邀请固定文案（短信 / 邮件不可在管理端修改）。
 * 占位符：{name} {event_name} {event_date} {link} {organizer} {location}
 */
export const FIXED_PARTICIPANT_INVITE_TEMPLATE =
  "{name}，您好！诚邀您参加 {event_name}（{event_date}）。点击链接打开玖莅，完成入场激活：{link}";

export const FIXED_PARTICIPANT_INVITE_SUBJECT =
  "【玖莅】诚邀您参加 {event_name}";
