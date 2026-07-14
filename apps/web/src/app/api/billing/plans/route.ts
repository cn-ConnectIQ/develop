import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { listActiveBillingPlans } from "@/lib/billing/order-service";

async function requireBillingAdmin() {
  const result = await requireAccountAdmin();
  if ("error" in result) {
    const status = result.error.status;
    throw new ApiError(
      status === 401 ? "未登录" : "无权访问",
      status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN,
      status,
    );
  }
  return result;
}

/** 可售套餐列表 */
export const GET = withErrorHandler(async () => {
  await requireBillingAdmin();
  const plans = await listActiveBillingPlans();
  return createSuccessResponse(plans);
});
