import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { verifyStampScanCode } from "@/lib/stamp/stamp-collect-service";

/** 校验章码有效性（扫码前预检） */
export const GET = withErrorHandler(async (request, context) => {
  const stampId = context?.params?.stampId;
  if (!stampId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) {
    return createErrorResponse("缺少章码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await verifyStampScanCode(stampId, code);
  return createSuccessResponse(result);
});
