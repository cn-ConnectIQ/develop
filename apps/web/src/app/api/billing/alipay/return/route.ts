import { BillingPaymentChannel, prisma } from "@connectiq/database";
import { NextRequest, NextResponse } from "next/server";
import {
  getAlipayConfigStatus,
  isAlipayTradeSuccess,
  verifyAlipayNotify,
} from "@/lib/billing/alipay";
import { absolutePublicUrl } from "@/lib/billing/public-url";
import { markOrderPaidAndFulfill } from "@/lib/billing/wallet-service";
import { syncOrderFromAlipayQuery } from "@/lib/billing/order-service";

export const runtime = "nodejs";

/**
 * 支付宝同步 return_url：用户支付后浏览器跳回。
 * 验签通过后尽量入账，再跳转到结果页。
 */
export async function GET(request: NextRequest) {
  const params: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    params[key] = value;
  });

  const outTradeNo = params.out_trade_no ?? "";
  let paid = false;

  try {
    if (
      outTradeNo &&
      getAlipayConfigStatus().configured &&
      Object.keys(params).length > 0
    ) {
      const signedOk = params.sign ? verifyAlipayNotify(params) : false;
      if (signedOk && isAlipayTradeSuccess(params.trade_status)) {
        await markOrderPaidAndFulfill(outTradeNo, {
          paymentChannel: BillingPaymentChannel.ALIPAY,
          externalPaymentId: params.trade_no,
        });
        paid = true;
      } else if (outTradeNo) {
        // return 参数不全时主动查单补偿
        const synced = await syncOrderFromAlipayQuery(outTradeNo);
        paid = synced.order.status === "PAID";
      }
    } else if (outTradeNo && getAlipayConfigStatus().configured) {
      const synced = await syncOrderFromAlipayQuery(outTradeNo);
      paid = synced.order.status === "PAID";
    }
  } catch (err) {
    console.warn("[alipay return] fulfill failed", outTradeNo, err);
  }

  if (outTradeNo) {
    const order = await prisma.billingOrder.findUnique({
      where: { id: outTradeNo },
      select: { status: true },
    });
    paid = order?.status === "PAID" || paid;
  }

  const target = absolutePublicUrl(
    `/billing/result?orderId=${encodeURIComponent(outTradeNo)}&paid=${paid ? "1" : "0"}`,
  );
  return NextResponse.redirect(target);
}
