import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { buildInviteShortUrl } from "@/lib/invite/token";

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
  return format(date, "M月d日", { locale: zhCN });
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

export function computeTokenExpiresAt(eventEndDate: Date | null | undefined) {
  const base = eventEndDate ?? new Date();
  const expires = new Date(base);
  expires.setDate(expires.getDate() + 7);
  return expires;
}
