import { withPublicPath } from "@/lib/public-path";

/** 站点绝对 URL（含 /uc 前缀），用于支付回调 notify_url / return_url */
export function absolutePublicUrl(path: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const pathname = withPublicPath(path.startsWith("/") ? path : `/${path}`);
  if (appUrl) {
    try {
      const origin = new URL(appUrl).origin;
      return `${origin}${pathname}`;
    } catch {
      /* fall through */
    }
  }
  return `http://localhost:3000${pathname}`;
}
