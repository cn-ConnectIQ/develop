import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getPlatformOrganizationDetail,
  PlatformOrganizationError,
} from "@/lib/platform-organization-service";

export const GET = withErrorHandler(async (_request, context) => {
  await requirePlatformAdmin();
  const orgId = context?.params?.orgId;
  if (!orgId) {
    return createErrorResponse("缺少组织 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    const data = await getPlatformOrganizationDetail(orgId);
    return createSuccessResponse(data);
  } catch (e) {
    if (e instanceof PlatformOrganizationError && e.code === "NOT_FOUND") {
      return createErrorResponse(e.message, ErrorCode.NOT_FOUND, 404);
    }
    throw e;
  }
});
