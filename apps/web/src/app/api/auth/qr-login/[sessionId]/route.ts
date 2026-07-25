import type { NextResponse } from "next/server";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getQrLoginSession } from "@/lib/integrations/baige-login-ticket";

/**
 * GET /api/auth/qr-login/[sessionId]
 * 浏览器轮询扫码状态；confirmed 时返回 loginToken 供 signIn("baige-sso")。
 */
export const GET = withErrorHandler(
  async (_request, context): Promise<NextResponse> => {
    const sessionId = context?.params?.sessionId?.trim();
    if (!sessionId) {
      return createErrorResponse("缺少 sessionId", ErrorCode.VALIDATION_ERROR, 400);
    }

    const state = await getQrLoginSession(sessionId);
    if (state.status === "pending") {
      return createSuccessResponse({ status: "pending" });
    }
    if (state.status === "expired") {
      return createSuccessResponse({ status: "expired" });
    }
    return createSuccessResponse({
      status: "confirmed",
      loginToken: state.loginToken,
      provider: "baige-sso",
    });
  },
);
