import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getPublicBoothDetail } from "@/lib/mobile-booth-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 展位详情（参会者） */
export const GET = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireMobileAuth(request);
  const data = await getPublicBoothDetail(boothId);
  return createSuccessResponse(data);
});
