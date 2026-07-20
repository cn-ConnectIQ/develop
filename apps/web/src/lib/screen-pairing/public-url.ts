/** 现场投影大屏唯一公开入口（浏览器打开后展示动态配对二维码） */
export function getScreenPairingPublicUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SCREEN_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (appUrl) {
    try {
      const { origin } = new URL(
        appUrl.startsWith("http") ? appUrl : `https://${appUrl}`,
      );
      return `${origin}/s`;
    } catch {
      // fall through
    }
  }

  return "https://9li.co/s";
}
