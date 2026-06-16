import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { exportMemberToMarketup } from "@/lib/org-member-service";

export const POST = withErrorHandler(async (_request, context) => {
  const auth = await requireAccountAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await exportMemberToMarketup(auth.orgId, userId);
  if (!result) {
    return createErrorResponse("用户不在用户池中", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(result);
});
