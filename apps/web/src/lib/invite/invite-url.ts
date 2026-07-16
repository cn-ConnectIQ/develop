/** 邀请短链（纯函数，可进 Client Bundle） */
export function buildInviteShortUrl(token: string): string {
  const base =
    process.env.SHORT_LINK_BASE?.replace(/\/$/, "") ||
    process.env.NEXT_PUBLIC_SHORT_LINK_BASE?.replace(/\/$/, "") ||
    "https://9li.co";
  return `${base}/a/${token}`;
}
