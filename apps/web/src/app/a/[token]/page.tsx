import { redirect } from "next/navigation";
import { resolveInviteToken } from "@/lib/invite/claim-service";
import { resolveAndClickShortLink } from "@/lib/notification/short-link-service";
import { ShortLinkScene } from "@connectiq/database";
import { InviteTransferClient } from "@/components/invite/InviteTransferClient";
import { InviteExpiredPage } from "@/components/invite/InviteExpiredPage";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ token: string }>;
};

/**
 * https://9li.co/a/{token}
 * 优先解析邀请认领；有微信 URL Link 时直接 302（短信短链可长期不变）；
 * 否则回退 H5 中转页 / 通知短链。
 */
export default async function AttendeeShortLinkPage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    return <InviteExpiredPage />;
  }

  const invite = await resolveInviteToken({ token });
  if (invite.kind === "ok") {
    // MarketUP 同思路：自有短链 → 微信 URL Link → 小程序
    // weixin:// Scheme 留给客户端跳转（服务端 302 对部分环境无效）
    if (
      invite.mp_url_link?.startsWith("http://") ||
      invite.mp_url_link?.startsWith("https://")
    ) {
      redirect(invite.mp_url_link);
    }
    return <InviteTransferClient data={invite} />;
  }
  if (invite.kind === "expired" || invite.kind === "invalid") {
    const short = await resolveAndClickShortLink(token);
    if (short && !short.expired && short.row.scene === ShortLinkScene.A) {
      redirect(short.row.targetUrl);
    }
    return <InviteExpiredPage reason={invite.kind} />;
  }

  return <InviteExpiredPage />;
}
