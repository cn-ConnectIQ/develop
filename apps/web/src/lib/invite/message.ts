import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

export type InviteMessageContext = {
  name: string;
  eventName: string;
  eventDate: string;
  link: string;
  organizer: string;
};

export function buildActivationLink(token: string, eventId?: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    "https://app.connectiq.cn";
  const url = new URL("/join", base.replace(/\/$/, ""));
  url.searchParams.set("token", token);
  if (eventId) url.searchParams.set("event", eventId);
  return url.toString();
}

export function formatEventDate(date: Date | null | undefined) {
  if (!date) return "日期待定";
  return format(date, "M月d日", { locale: zhCN });
}

export function resolveInviteMessage(
  template: string,
  ctx: InviteMessageContext,
): string {
  return template
    .replaceAll("{name}", ctx.name)
    .replaceAll("{event_name}", ctx.eventName)
    .replaceAll("{event_date}", ctx.eventDate)
    .replaceAll("{link}", ctx.link)
    .replaceAll("{organizer}", ctx.organizer);
}

export function computeTokenExpiresAt(eventEndDate: Date | null | undefined) {
  const base = eventEndDate ?? new Date();
  const expires = new Date(base);
  expires.setDate(expires.getDate() + 7);
  return expires;
}
