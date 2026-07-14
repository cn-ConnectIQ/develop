/**
 * 微信支付占位（待商户号 / API v3 证书就绪后再实现）
 */

export type WechatPayConfigStatus = {
  configured: boolean;
  missing: string[];
};

export function getWechatPayConfigStatus(): WechatPayConfigStatus {
  const missing: string[] = [];
  if (!process.env.WECHAT_PAY_MCH_ID?.trim()) missing.push("WECHAT_PAY_MCH_ID");
  if (!process.env.WECHAT_PAY_API_V3_KEY?.trim()) {
    missing.push("WECHAT_PAY_API_V3_KEY");
  }
  if (!process.env.WECHAT_PAY_SERIAL_NO?.trim()) {
    missing.push("WECHAT_PAY_SERIAL_NO");
  }
  if (!process.env.WECHAT_PAY_PRIVATE_KEY?.trim()) {
    missing.push("WECHAT_PAY_PRIVATE_KEY");
  }
  // 公众号/小程序 appid：优先独立支付变量，否则回落已有小程序/服务号
  const appId =
    process.env.WECHAT_PAY_APP_ID?.trim() ||
    process.env.WX_MINI_APPID?.trim() ||
    process.env.WX_MP_APPID?.trim();
  if (!appId) missing.push("WECHAT_PAY_APP_ID（或 WX_MINI_APPID / WX_MP_APPID）");

  return { configured: false, missing };
}

export function assertWechatPayReady(): never {
  const status = getWechatPayConfigStatus();
  throw new Error(
    `微信支付尚未接入。待配置项: ${status.missing.join(", ")}`,
  );
}
