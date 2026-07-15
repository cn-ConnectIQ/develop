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
 * 优先解析邀请认领；否则回退通知短链 302。
 */
export default async function AttendeeShortLinkPage({ params }: PageProps) {
  const { token } = await params;
  if (!token) {
    return <InviteExpiredPage />;
  }

  const invite = await resolveInviteToken({ token });
  if (invite.kind === "ok") {
    return <InviteTransferClient data={invite} />;
  }
  if (invite.kind === "expired" || invite.kind === "invalid") {
    // 可能是通知短链（scene A）
    const short = await resolveAndClickShortLink(token);
    if (short && !short.expired && short.row.scene === ShortLinkScene.A) {
      redirect(short.row.targetUrl);
    }
    return <InviteExpiredPage reason={invite.kind} />;
  }

  return <InviteExpiredPage />;
}
