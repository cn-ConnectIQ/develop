/** fill_get_gift · 类型③ 填表必得（QUICK-03B） */
export const QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT = "fill_get_gift" as const;
export const QUICK_LAUNCH_CODE_03B = "QUICK-03B" as const;

export type QuickLaunchTemplateId =
  typeof QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT;

export function isFillGetGiftTemplate(template: unknown): template is QuickLaunchTemplateId {
  return template === QUICK_LAUNCH_TEMPLATE_FILL_GET_GIFT;
}
