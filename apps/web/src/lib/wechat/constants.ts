/** user_identities.provider 约定 */
export const WECHAT_IDENTITY = {
  MINI: "wechat_mini",
  MP: "wechat_mp",
  UNIONID: "wechat_unionid",
} as const;

export type WechatIdentityChannel = "mini" | "mp";
