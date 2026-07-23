import { ErrorCode } from "@connectiq/types";
import type { NextResponse } from "next/server";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  BaigeConnectionError,
  formatBaigeConnectionStatus,
  getBaigeConnectionByOrgId,
  revokeBaigeConnection,
} from "@/lib/integrations/baige-connection-service";
import {
  isBaigeOAuthConfigured,
  isBaigePartnerDevMode,
} from "@/lib/integrations/baige-partner-constants";
import {
  BaigeOAuthError,
  linkBaigeConnectionDev,
} from "@/lib/integrations/baige-oauth";

export const GET = withErrorHandler(async (): Promise<NextResponse> => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  const connection = await getBaigeConnectionByOrgId(result.orgId);
  return createSuccessResponse({
    ...formatBaigeConnectionStatus(connection),
    oauthConfigured: isBaigeOAuthConfigured(),
    devLinkEnabled: isBaigePartnerDevMode() || !isBaigeOAuthConfigured(),
  });
});

const linkSchema = z.object({
  baigeOrgId: z.string().min(1, "请提供百格组织 ID"),
  baigeOrgName: z.string().optional(),
});

/** 开发/联调直连；正式环境应走 OAuth start/callback */
export const POST = withErrorHandler(async (request): Promise<NextResponse> => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  const body = await request.json().catch(() => null);
  const parsed = linkSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (!isBaigePartnerDevMode() && isBaigeOAuthConfigured()) {
    return createErrorResponse(
      "请使用 OAuth 授权连接（/api/partner/baige/oauth/start）",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const connection = await linkBaigeConnectionDev({
      orgId: result.orgId,
      userId: result.session.user.id,
      externalOrgId: parsed.data.baigeOrgId,
      externalOrgName: parsed.data.baigeOrgName,
    });
    return createSuccessResponse(formatBaigeConnectionStatus(connection));
  } catch (error) {
    if (error instanceof BaigeConnectionError || error instanceof BaigeOAuthError) {
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, 400);
    }
    throw error;
  }
});

export const DELETE = withErrorHandler(async (): Promise<NextResponse> => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  try {
    const connection = await revokeBaigeConnection(result.orgId);
    return createSuccessResponse(formatBaigeConnectionStatus(connection));
  } catch (error) {
    if (error instanceof BaigeConnectionError) {
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, 400);
    }
    throw error;
  }
});
