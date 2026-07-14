import { BillingPaymentChannel, prisma } from "@connectiq/database";
import { NextRequest, NextResponse } from "next/server";
import {
  isAlipayTradeSuccess,
  verifyAlipayNotify,
} from "@/lib/billing/alipay";
import { markOrderPaidAndFulfill } from "@/lib/billing/wallet-service";

export const runtime = "nodejs";

function formToRecord(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/**
 * 支付宝异步通知（须返回纯文本 success / fail）
 * 开放平台配置：https://9li.co/uc/api/billing/alipay/notify
 */
export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let params: Record<string, string>;

    if (contentType.includes("application/json")) {
      params = (await request.json()) as Record<string, string>;
    } else {
      params = formToRecord(await request.formData());
    }

    if (!verifyAlipayNotify(params)) {
      console.warn("[alipay notify] sign verify failed", {
        outTradeNo: params.out_trade_no,
      });
      return new NextResponse("fail", {
        status: 400,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const outTradeNo = params.out_trade_no;
    const tradeNo = params.trade_no;
    const tradeStatus = params.trade_status;

    if (!outTradeNo || !isAlipayTradeSuccess(tradeStatus)) {
      return new NextResponse("success", {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    const order = await prisma.billingOrder.findUnique({
      where: { id: outTradeNo },
    });
    if (!order) {
      console.warn("[alipay notify] order not found", outTradeNo);
      return new NextResponse("fail", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    // 可选金额校验（防篡改）
    if (params.total_amount) {
      const expected = (order.amountCents / 100).toFixed(2);
      if (params.total_amount !== expected) {
        console.error("[alipay notify] amount mismatch", {
          outTradeNo,
          expected,
          got: params.total_amount,
        });
        return new NextResponse("fail", {
          status: 400,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    }

    await markOrderPaidAndFulfill(order.id, {
      paymentChannel: BillingPaymentChannel.ALIPAY,
      externalPaymentId: tradeNo,
    });

    return new NextResponse("success", {
      status: 200,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err) {
    console.error("[alipay notify]", err);
    return new NextResponse("fail", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
