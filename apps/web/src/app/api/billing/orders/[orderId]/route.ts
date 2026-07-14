import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getOrgOrder,
  syncOrderFromAlipayQuery,
} from "@/lib/billing/order-service";
import { getAlipayConfigStatus } from "@/lib/billing/alipay";

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

/** 订单详情；?sync=1 时向支付宝查单并补偿入账 */
export const GET = withErrorHandler(async (request, ctx) => {
  const { orgId } = await requireBillingAdmin();
  const orderId = ctx?.params?.orderId;
  if (!orderId) {
    throw new ApiError("缺少订单 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const sync =
    request.nextUrl.searchParams.get("sync") === "1" ||
    request.nextUrl.searchParams.get("sync") === "true";

  if (sync && getAlipayConfigStatus().configured) {
    try {
      await syncOrderFromAlipayQuery(orderId);
    } catch (err) {
      console.warn("[billing] alipay sync failed", orderId, err);
    }
  }

  const order = await getOrgOrder(orgId, orderId);
  if (!order) {
    throw new ApiError("订单不存在", ErrorCode.NOT_FOUND, 404);
  }
  return createSuccessResponse(order);
});
