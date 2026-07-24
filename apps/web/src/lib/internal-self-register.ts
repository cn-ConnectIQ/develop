/**
 * 内部测试用公开报名入口开关。
 * 正式开放自助报名产品能力前，可整段关掉按钮与页面。
 */
export const ENABLE_INTERNAL_SELF_REGISTER = true;

export function selfRegisterPath(eventId: string): string {
  return `/r/${eventId}`;
}
