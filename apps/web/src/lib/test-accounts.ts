/** 与 packages/database/prisma/seed.ts 保持一致 */
export const SEED_PASSWORD = "ConnectIQ2024!";

export function seedAccountEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

/** B 端仅两类登录：平台管理员 + 账号管理员（活动形态由 activityType 区分） */
export const SEED_TEST_ACCOUNTS = {
  password: SEED_PASSWORD,
  platformAdmin: {
    phone: "13800000001",
    email: seedAccountEmail("13800000001"),
    label: "平台管理员",
  },
  accountAdmin: {
    phone: "13800000008",
    email: seedAccountEmail("13800000008"),
    label: "账号管理员（统一组织 · 可办会议/展会/参展）",
  },
} as const;
