import { BillingPaymentChannel } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { createBillingOrder } from "@/lib/billing/order-service";
import { prisma } from "@connectiq/database";

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

const createSchema = z.object({
  planId: z.string().min(1),
  eventId: z.string().optional(),
  paymentChannel: z
    .enum(["ALIPAY", "WECHAT", "MANUAL"])
    .optional()
    .default("ALIPAY"),
});

/** 创建待支付订单 */
export const POST = withErrorHandler(async (request) => {
  const { session, orgId } = await requireBillingAdmin();
  const body = createSchema.parse(await request.json());

  try {
    const order = await createBillingOrder({
      orgId,
      planId: body.planId,
      eventId: body.eventId,
      createdByUserId: session.user.id,
      paymentChannel: body.paymentChannel as BillingPaymentChannel,
    });
    return createSuccessResponse(order);
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? err.message : "创建订单失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
});

/** 当前组织订单列表（最近 50 条） */
export const GET = withErrorHandler(async () => {
  const { orgId } = await requireBillingAdmin();
  const orders = await prisma.billingOrder.findMany({
    where: { orgId },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return createSuccessResponse(orders);
});
