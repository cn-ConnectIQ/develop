import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  buildMobileBoothDashboard,
  resolveMobileExhibitorBoothAccess,
} from "@/lib/mobile-exhibitor-service";

/** 展商展位 dashboard（小程序 camelCase 字段） */
export const GET = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const access = await resolveMobileExhibitorBoothAccess(request, boothId);
  const dashboard = await buildMobileBoothDashboard(access.boothId, access.eventId);
  return createSuccessResponse(dashboard);
});
