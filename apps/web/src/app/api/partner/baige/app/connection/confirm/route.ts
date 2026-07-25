import type { NextResponse } from "next/server";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { ErrorCode } from "@connectiq/types";
import { upsertBaigeConnection } from "@/lib/integrations/baige-connection-service";
import { formatBaigeAppConnection } from "@/lib/integrations/baige-app-service";
import { BaigeConnectionError } from "@/lib/integrations/baige-connection-service";
import { mapBaigeAppError } from "@/lib/integrations/baige-partner-http";
import { cacheDel, cacheGet } from "@/lib/redis";

const bodySchema = z.object({
  state: z.string().min(1),
});

/**
 * 玖莅管理员确认百格 App 发起的授权 pending state。
 * POST /api/partner/baige/app/connection/confirm  Body: { state }
 * 鉴权：登录态账号管理员（非 Partner API Key）
 */
export const POST = withErrorHandler(async (request): Promise<NextResponse> => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("缺少 state", ErrorCode.VALIDATION_ERROR, 400);
  }

  const raw = await cacheGet(`baige-app-authorize:${parsed.data.state}`);
  if (!raw) {
    return createErrorResponse(
      "授权请求已过期，请从百格 App 重新发起",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  let payload: {
    baigeOrgId?: string;
    baigeUserId?: string | null;
    scopes?: string[];
    redirectUri?: string | null;
  };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    return createErrorResponse("授权状态无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (!payload.baigeOrgId) {
    return createErrorResponse("授权状态缺少 baigeOrgId", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    await upsertBaigeConnection({
      orgId: result.orgId,
      externalOrgId: payload.baigeOrgId,
      linkedByUserId: result.session.user.id,
      scopes: payload.scopes,
      metadata: {
        source: "baige_app",
        baigeUserId: payload.baigeUserId ?? null,
        redirectUri: payload.redirectUri ?? null,
      },
    });
    await cacheDel(`baige-app-authorize:${parsed.data.state}`);

    const connection = await formatBaigeAppConnection(payload.baigeOrgId);
    return createSuccessResponse({
      ...connection,
      redirectUri: payload.redirectUri ?? null,
    });
  } catch (error) {
    const mapped = mapBaigeAppError(error);
    if (mapped) return mapped;
    if (error instanceof BaigeConnectionError) {
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, 400);
    }
    throw error;
  }
});
