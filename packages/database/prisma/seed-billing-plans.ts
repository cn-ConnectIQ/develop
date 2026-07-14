/**
 * 种子默认计费套餐（对齐官网定价设计）
 * 用法: pnpm --filter @connectiq/database db:seed:billing-plans
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, "../../apps/web/.env.local") });

const { BillingPlanKind, prisma } = await import("../src/index");

const PLANS = [
  {
    code: "EVENT_UNDER_500",
    kind: BillingPlanKind.EVENT_USAGE,
    name: "按场 · 500 人以下",
    description: "含 10 个互动点；适合沙龙/中型会议",
    priceCents: 99900,
    includesInteractionPoints: 10,
    includesSms: 0,
    includesEmail: 0,
    maxAttendees: 500,
    sortOrder: 10,
  },
  {
    code: "EVENT_OVER_500",
    kind: BillingPlanKind.EVENT_USAGE,
    name: "按场 · 500 人以上",
    description: "含 20 个互动点；适合大型会议/展会配套会务",
    priceCents: 199900,
    includesInteractionPoints: 20,
    includesSms: 0,
    includesEmail: 0,
    maxAttendees: null,
    sortOrder: 20,
  },
  {
    code: "INTERACTION_POINT_1",
    kind: BillingPlanKind.INTERACTION_TOPUP,
    name: "互动点 · 超额 1 个",
    description: "超出套餐后按需购买，¥150 / 点",
    priceCents: 15000,
    includesInteractionPoints: 1,
    includesSms: 0,
    includesEmail: 0,
    maxAttendees: null,
    sortOrder: 30,
  },
  {
    code: "SMS_PACK_500",
    kind: BillingPlanKind.SMS_PACK,
    name: "短信包 · 500 条",
    description: "验证码 / 审核通知 / 邀请短信可用",
    priceCents: 4500,
    includesSms: 500,
    includesEmail: 0,
    includesInteractionPoints: 0,
    maxAttendees: null,
    sortOrder: 40,
  },
  {
    code: "SMS_PACK_2000",
    kind: BillingPlanKind.SMS_PACK,
    name: "短信包 · 2000 条",
    description: "批量邀请与会务通知",
    priceCents: 16000,
    includesSms: 2000,
    includesEmail: 0,
    includesInteractionPoints: 0,
    maxAttendees: null,
    sortOrder: 50,
  },
  {
    code: "EMAIL_PACK_1000",
    kind: BillingPlanKind.EMAIL_PACK,
    name: "邮件包 · 1000 封",
    description: "邀请邮件与审核通知",
    priceCents: 3000,
    includesSms: 0,
    includesEmail: 1000,
    includesInteractionPoints: 0,
    maxAttendees: null,
    sortOrder: 60,
  },
  {
    code: "EMAIL_PACK_5000",
    kind: BillingPlanKind.EMAIL_PACK,
    name: "邮件包 · 5000 封",
    description: "大型活动批量邮件触达",
    priceCents: 12000,
    includesSms: 0,
    includesEmail: 5000,
    includesInteractionPoints: 0,
    maxAttendees: null,
    sortOrder: 70,
  },
] as const;

async function main() {
  for (const plan of PLANS) {
    await prisma.billingPlan.upsert({
      where: { code: plan.code },
      create: { ...plan, isActive: true },
      update: {
        kind: plan.kind,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        includesSms: plan.includesSms,
        includesEmail: plan.includesEmail,
        includesInteractionPoints: plan.includesInteractionPoints,
        maxAttendees: plan.maxAttendees,
        sortOrder: plan.sortOrder,
        isActive: true,
      },
    });
    console.log(`✓ plan ${plan.code}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
