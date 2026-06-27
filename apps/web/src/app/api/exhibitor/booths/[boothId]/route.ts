import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getMobileBoothConfig,
  resolveMobileExhibitorBoothAccess,
} from "@/lib/mobile-exhibitor-service";

/** 展商展位配置 */
export const GET = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await resolveMobileExhibitorBoothAccess(request, boothId);
  const config = await getMobileBoothConfig(boothId);
  return createSuccessResponse(config);
});
