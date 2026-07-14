import {
  BillingOrderStatus,
  BillingPaymentChannel,
  prisma,
} from "@connectiq/database";
import {
  buildAlipayPagePayUrl,
  getAlipayConfigStatus,
  isAlipayTradeSuccess,
  queryAlipayTrade,
} from "@/lib/billing/alipay";
import { assertWechatPayReady } from "@/lib/billing/wechat-pay";
import { markOrderPaidAndFulfill } from "@/lib/billing/wallet-service";

export async function listActiveBillingPlans() {
  return prisma.billingPlan.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createBillingOrder(input: {
  orgId: string;
  planId: string;
  createdByUserId?: string;
  eventId?: string;
  paymentChannel?: BillingPaymentChannel;
}) {
  const plan = await prisma.billingPlan.findFirst({
    where: { id: input.planId, isActive: true },
  });
  if (!plan) {
    throw new Error("套餐不存在或已下架");
  }

  if (input.eventId) {
    const event = await prisma.event.findFirst({
      where: { id: input.eventId, orgId: input.orgId },
      select: { id: true },
    });
    if (!event) {
      throw new Error("活动不存在或不属于当前组织");
    }
  }

  return prisma.billingOrder.create({
    data: {
      orgId: input.orgId,
      planId: plan.id,
      createdByUserId: input.createdByUserId,
      eventId: input.eventId,
      status: BillingOrderStatus.PENDING,
      paymentChannel: input.paymentChannel ?? BillingPaymentChannel.ALIPAY,
      amountCents: plan.priceCents,
      currency: "CNY",
      title: plan.name,
    },
    include: { plan: true },
  });
}

export async function getOrgOrder(orgId: string, orderId: string) {
  return prisma.billingOrder.findFirst({
    where: { id: orderId, orgId },
    include: { plan: true },
  });
}

export type StartPayResult =
  | {
      channel: "ALIPAY";
      orderId: string;
      payUrl: string;
    }
  | {
      channel: "WECHAT";
      orderId: string;
      // 预留
      prepay?: unknown;
    };

/** 发起第三方支付（当前仅支付宝 page.pay） */
export async function startOrderPayment(input: {
  orgId: string;
  orderId: string;
  channel: "ALIPAY" | "WECHAT";
}): Promise<StartPayResult> {
  const order = await getOrgOrder(input.orgId, input.orderId);
  if (!order) throw new Error("订单不存在");
  if (order.status === BillingOrderStatus.PAID) {
    throw new Error("订单已支付");
  }
  if (order.status !== BillingOrderStatus.PENDING) {
    throw new Error(`订单状态不可支付: ${order.status}`);
  }

  if (input.channel === "WECHAT") {
    assertWechatPayReady();
  }

  const status = getAlipayConfigStatus();
  if (!status.configured) {
    throw new Error(`支付宝未配置，缺少: ${status.missing.join(", ")}`);
  }

  await prisma.billingOrder.update({
    where: { id: order.id },
    data: { paymentChannel: BillingPaymentChannel.ALIPAY },
  });

  const payUrl = buildAlipayPagePayUrl({
    outTradeNo: order.id,
    amountCents: order.amountCents,
    subject: order.title,
    body: order.plan?.code ?? order.id,
  });

  return { channel: "ALIPAY", orderId: order.id, payUrl };
}

/**
 * 用支付宝查单结果同步本地订单（前端轮询 / return 页补偿）
 */
export async function syncOrderFromAlipayQuery(orderId: string) {
  const order = await prisma.billingOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("订单不存在");
  if (order.status === BillingOrderStatus.PAID) {
    return { order, synced: false as const };
  }

  const result = await queryAlipayTrade(order.id);
  const tradeStatus = String(
    result.tradeStatus ?? result.trade_status ?? "",
  );
  const tradeNo = String(result.tradeNo ?? result.trade_no ?? "");

  if (!isAlipayTradeSuccess(tradeStatus)) {
    return {
      order,
      synced: false as const,
      tradeStatus,
    };
  }

  const { order: paid, fulfilled } = await markOrderPaidAndFulfill(order.id, {
    paymentChannel: BillingPaymentChannel.ALIPAY,
    externalPaymentId: tradeNo || undefined,
  });

  return { order: paid, synced: true as const, fulfilled, tradeStatus };
}
