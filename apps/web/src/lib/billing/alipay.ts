import { AlipaySdk } from "alipay-sdk";
import { absolutePublicUrl } from "@/lib/billing/public-url";

export type AlipayConfigStatus = {
  configured: boolean;
  missing: string[];
  gateway: string;
  appIdMasked?: string;
};

function normalizeKey(raw: string): string {
  return raw.replace(/\\n/g, "\n").trim();
}

export function getAlipayEnv() {
  const appId = process.env.ALIPAY_APP_ID?.trim() ?? "";
  const privateKey = normalizeKey(process.env.ALIPAY_PRIVATE_KEY ?? "");
  const alipayPublicKey = normalizeKey(process.env.ALIPAY_PUBLIC_KEY ?? "");
  const gateway =
    process.env.ALIPAY_GATEWAY?.trim() ||
    "https://openapi.alipay.com/gateway.do";
  const notifyUrl =
    process.env.ALIPAY_NOTIFY_URL?.trim() ||
    absolutePublicUrl("/api/billing/alipay/notify");
  const returnUrl =
    process.env.ALIPAY_RETURN_URL?.trim() ||
    absolutePublicUrl("/api/billing/alipay/return");

  return {
    appId,
    privateKey,
    alipayPublicKey,
    gateway,
    notifyUrl,
    returnUrl,
  };
}

export function getAlipayConfigStatus(): AlipayConfigStatus {
  const env = getAlipayEnv();
  const missing: string[] = [];
  if (!env.appId) missing.push("ALIPAY_APP_ID");
  if (!env.privateKey) missing.push("ALIPAY_PRIVATE_KEY");
  if (!env.alipayPublicKey) missing.push("ALIPAY_PUBLIC_KEY");
  return {
    configured: missing.length === 0,
    missing,
    gateway: env.gateway,
    appIdMasked: env.appId
      ? `${env.appId.slice(0, 4)}…${env.appId.slice(-4)}`
      : undefined,
  };
}

let cachedSdk: AlipaySdk | null = null;

export function getAlipaySdk(): AlipaySdk {
  const status = getAlipayConfigStatus();
  if (!status.configured) {
    throw new Error(
      `支付宝未配置，缺少: ${status.missing.join(", ")}`,
    );
  }
  if (cachedSdk) return cachedSdk;

  const env = getAlipayEnv();
  cachedSdk = new AlipaySdk({
    appId: env.appId,
    privateKey: env.privateKey,
    alipayPublicKey: env.alipayPublicKey,
    gateway: env.gateway,
    signType: "RSA2",
    keyType: (process.env.ALIPAY_KEY_TYPE?.trim() as "PKCS1" | "PKCS8") || "PKCS1",
  });
  return cachedSdk;
}

/** 金额：分 → 元（两位小数） */
export function centsToAlipayYuan(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * 电脑网站支付：返回可跳转的 gateway GET URL（pageExecute GET）
 * @see https://opendocs.alipay.com/open/59da99d0_alipay.trade.page.pay
 */
export function buildAlipayPagePayUrl(input: {
  outTradeNo: string;
  amountCents: number;
  subject: string;
  body?: string;
}): string {
  const sdk = getAlipaySdk();
  const env = getAlipayEnv();
  return sdk.pageExecute("alipay.trade.page.pay", "GET", {
    notifyUrl: env.notifyUrl,
    returnUrl: env.returnUrl,
    bizContent: {
      outTradeNo: input.outTradeNo,
      productCode: "FAST_INSTANT_TRADE_PAY",
      totalAmount: centsToAlipayYuan(input.amountCents),
      subject: input.subject.slice(0, 256),
      body: input.body?.slice(0, 128),
    },
  });
}

/** 异步通知验签 */
export function verifyAlipayNotify(params: Record<string, string>): boolean {
  const sdk = getAlipaySdk();
  return sdk.checkNotifySign(params);
}

/** 主动查单（补偿：用户关窗后前端轮询） */
export async function queryAlipayTrade(outTradeNo: string) {
  const sdk = getAlipaySdk();
  return sdk.exec("alipay.trade.query", {
    bizContent: { outTradeNo },
  });
}

export function isAlipayTradeSuccess(tradeStatus: string | undefined): boolean {
  return tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED";
}
