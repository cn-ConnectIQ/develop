/** 与 packages/database/prisma/seed.ts 保持一致 */
export const SEED_PASSWORD = "BagEvent1001";

/** 账号管理员测试邮箱（邮箱唯一，平台管理员另用 PLATFORM_ADMIN_EMAIL） */
export const ACCOUNT_ADMIN_EMAIL = "milo@bagevent.cn";

/** 平台管理员测试邮箱 */
export const PLATFORM_ADMIN_EMAIL = "platform@bagevent.cn";

export function seedAccountEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

/** B 端仅两类登录：平台管理员 + 账号管理员（活动形态由 activityType 区分） */
export const SEED_TEST_ACCOUNTS = {
  password: SEED_PASSWORD,
  platformAdmin: {
    phone: "13800000001",
    email: PLATFORM_ADMIN_EMAIL,
    label: "平台管理员",
  },
  accountAdmin: {
    phone: "13800000008",
    email: ACCOUNT_ADMIN_EMAIL,
    label: "账号管理员（统一组织 · 可办会议/展会/参展）",
  },
} as const;
