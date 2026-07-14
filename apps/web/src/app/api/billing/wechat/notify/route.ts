import { NextResponse } from "next/server";
import { getWechatPayConfigStatus } from "@/lib/billing/wechat-pay";

export const runtime = "nodejs";

/** 微信支付回调占位（商户参数就绪后再实现验签与入账） */
export async function POST() {
  const status = getWechatPayConfigStatus();
  return NextResponse.json(
    {
      error: "微信支付尚未接入",
      code: "WECHAT_PAY_NOT_READY",
      missing: status.missing,
    },
    { status: 501 },
  );
}
