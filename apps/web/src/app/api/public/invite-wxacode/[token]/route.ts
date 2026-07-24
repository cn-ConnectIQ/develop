import { NextResponse } from "next/server";
import { prisma } from "@connectiq/database";
import { withErrorHandler } from "@/lib/api-auth";
import { resolveInviteWxacodeImageUrl } from "@/lib/wechat/wxacode-image";
import { generateInviteEntryWxacode } from "@/lib/wechat/wxacode";
import { getWxMiniCredentials } from "@/lib/wechat/config";

export const dynamic = "force-dynamic";

/**
 * 公开小程序码图：供邮件客户端加载（须 HTTPS，勿用 data URL）。
 * GET /api/public/invite-wxacode/[token]
 */
export const GET = withErrorHandler(async (_request, context) => {
  const token = context?.params?.token?.trim();
  if (!token) {
    return new NextResponse("missing token", { status: 400 });
  }

  const entry = await prisma.inviteEntry.findUnique({
    where: { token },
    select: { token: true },
  });
  if (!entry) {
    return new NextResponse("not found", { status: 404 });
  }

  if (!getWxMiniCredentials()) {
    return new NextResponse("wx mini not configured", { status: 503 });
  }

  // 优先 CDN / 缓存 URL；再回退直接出 PNG
  const cachedUrl = await resolveInviteWxacodeImageUrl(token);
  if (cachedUrl?.startsWith("http")) {
    return NextResponse.redirect(cachedUrl, 302);
  }

  const code = await generateInviteEntryWxacode({ token, width: 280 });
  return new NextResponse(new Uint8Array(code.buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
});
