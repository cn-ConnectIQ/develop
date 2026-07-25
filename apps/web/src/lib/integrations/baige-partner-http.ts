import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ErrorCode } from "@connectiq/types";
import { createErrorResponse } from "@/lib/api-auth";
import {
  assertBaigePartnerApiKey,
  BaigePartnerAuthError,
} from "@/lib/integrations/baige-partner-auth";
import { BaigeConnectionError } from "@/lib/integrations/baige-connection-service";

/** 伙伴 API 错误：保留稳定 code 字符串给百格 App 映射中文文案 */
export function createBaigePartnerErrorResponse(
  message: string,
  code: string,
  status = 400,
) {
  return NextResponse.json({ error: message, code }, { status });
}

export function handleBaigePartnerAuth(request: NextRequest) {
  try {
    return assertBaigePartnerApiKey(request);
  } catch (error) {
    if (error instanceof BaigePartnerAuthError) {
      return createBaigePartnerErrorResponse(
        error.message,
        error.code,
        error.status,
      );
    }
    throw error;
  }
}

export function mapBaigeAppError(error: unknown) {
  if (error instanceof BaigeConnectionError) {
    const status =
      error.code === "NOT_LINKED"
        ? 404
        : error.code === "FORBIDDEN"
          ? 403
          : error.code === "MODULE_BUSY"
            ? 409
            : error.code === "EVENT_NOT_AUTHORIZED"
              ? 404
              : error.code === "EXTERNAL_ORG_TAKEN"
                ? 409
                : 400;
    return createBaigePartnerErrorResponse(error.message, error.code, status);
  }
  if (error instanceof BaigePartnerAuthError) {
    return createBaigePartnerErrorResponse(
      error.message,
      error.code,
      error.status,
    );
  }
  return null;
}

/** 兼容旧 createErrorResponse 调用处 */
export function baigeFallbackError(message: string, status = 400) {
  return createErrorResponse(message, ErrorCode.VALIDATION_ERROR, status);
}
