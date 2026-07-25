import type { NextResponse } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { createQrLoginSession } from "@/lib/integrations/baige-login-ticket";
import { getAppBaseUrl } from "@/lib/supabase/server";
import { withPublicPath } from "@/lib/public-path";

/**
 * POST /api/auth/qr-login
 * 浏览器创建扫码登录会话（公开）。
 */
export const POST = withErrorHandler(async (): Promise<NextResponse> => {
  const session = await createQrLoginSession();
  const base = getAppBaseUrl().replace(/\/$/, "");
  let loginHintUrl = withPublicPath(`/login?qr_session=${session.sessionId}`);
  try {
    loginHintUrl = `${new URL(base).origin}${loginHintUrl}`;
  } catch {
    loginHintUrl = `${base}${loginHintUrl}`;
  }

  return createSuccessResponse({
    sessionId: session.sessionId,
    expiresIn: session.expiresIn,
    deepLink: session.deepLink,
    /** 二维码内容：优先 deepLink，百格 App 识别；也可用 loginHintUrl */
    qrPayload: session.deepLink,
    pollPath: session.pollPath,
    loginHintUrl,
  });
});
