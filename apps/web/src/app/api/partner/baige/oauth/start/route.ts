import { ErrorCode } from "@connectiq/types";
import type { NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  BaigeOAuthError,
  createBaigeOAuthStart,
} from "@/lib/integrations/baige-oauth";

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  try {
    const started = await createBaigeOAuthStart({
      orgId: result.orgId,
      userId: result.session.user.id,
    });
    return createSuccessResponse({
      authorizeUrl: started.authorizeUrl,
      state: started.state,
    });
  } catch (error) {
    if (error instanceof BaigeOAuthError) {
      return createErrorResponse(
        error.message,
        ErrorCode.VALIDATION_ERROR,
        error.code === "NOT_CONFIGURED" ? 503 : 400,
      );
    }
    throw error;
  }
});

/** 浏览器跳转版：直接 302 到百格授权页 */
export const POST = withErrorHandler(async (): Promise<NextResponse | Response> => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  try {
    const started = await createBaigeOAuthStart({
      orgId: result.orgId,
      userId: result.session.user.id,
    });
    return Response.redirect(started.authorizeUrl, 302);
  } catch (error) {
    if (error instanceof BaigeOAuthError) {
      return createErrorResponse(
        error.message,
        ErrorCode.VALIDATION_ERROR,
        error.code === "NOT_CONFIGURED" ? 503 : 400,
      );
    }
    throw error;
  }
});
