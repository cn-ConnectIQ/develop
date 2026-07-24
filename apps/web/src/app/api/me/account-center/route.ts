import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { getOrgAccountCenter } from "@/lib/org-account-center-service";

/** B 端账号管理中心：跨活动累计 + 历史活动 + 留存引导（Web 管理端） */
export const GET = withErrorHandler(async () => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  try {
    const data = await getOrgAccountCenter(result.orgId);
    return createSuccessResponse(data);
  } catch (error) {
    console.error("[api/me/account-center]", error);
    const message =
      error instanceof Error ? error.message : "加载账号中心失败";
    return createErrorResponse(message, ErrorCode.INTERNAL_ERROR, 500);
  }
});
