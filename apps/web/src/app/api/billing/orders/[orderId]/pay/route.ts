import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { startOrderPayment } from "@/lib/billing/order-service";

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

const paySchema = z.object({
  channel: z.enum(["ALIPAY", "WECHAT"]).default("ALIPAY"),
});

/** 发起支付：支付宝返回 payUrl，前端跳转即可 */
export const POST = withErrorHandler(async (request, ctx) => {
  const { orgId } = await requireBillingAdmin();
  const orderId = ctx?.params?.orderId;
  if (!orderId) {
    throw new ApiError("缺少订单 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = paySchema.parse(await request.json().catch(() => ({})));

  try {
    const result = await startOrderPayment({
      orgId,
      orderId,
      channel: body.channel,
    });
    return createSuccessResponse(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "发起支付失败";
    const status = message.includes("尚未接入") || message.includes("未配置")
      ? 503
      : 400;
    throw new ApiError(
      message,
      status === 503 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_ERROR,
      status,
    );
  }
});
