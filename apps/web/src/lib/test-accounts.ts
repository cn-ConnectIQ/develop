/** 与 packages/database/prisma/seed.ts 保持一致 */
export const SEED_PASSWORD = "ConnectIQ2024!";

export function seedAccountEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

export const SEED_TEST_ACCOUNTS = {
  password: SEED_PASSWORD,
  platformAdmin: {
    phone: "13800000001",
    email: seedAccountEmail("13800000001"),
    label: "平台管理员",
  },
  conferenceOrganizer: {
    phone: "13800000002",
    email: seedAccountEmail("13800000002"),
    label: "会议主办方（SaaS 增长研究院）",
  },
  expoOrganizer: {
    phone: "13800000003",
    email: seedAccountEmail("13800000003"),
    label: "展览主办方",
  },
  exhibitor: {
    phone: "13800000004",
    email: seedAccountEmail("13800000004"),
    label: "参展商",
  },
} as const;
