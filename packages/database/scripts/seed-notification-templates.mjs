import { PrismaClient } from "@prisma/client";

const TEMPLATES = [
  {
    code: "SYS-01",
    name: "登录验证码",
    channel: "SMS",
    category: "VERIFY",
    audience: "ATTENDEE",
    subject: null,
    body: "【玖莅】验证码 {码},5分钟内有效。请勿向他人泄露。",
    variables: ["码"],
    requiresOptOut: false,
  },
  {
    code: "ATT-01",
    name: "首次激活邀请(短信)",
    channel: "SMS",
    category: "MARKETING",
    audience: "ATTENDEE",
    subject: null,
    body: "【玖莅】{姓氏称谓},您报名的{活动简称}将于{开幕日期}开幕。开启AI配对,提前锁定值得见的人:{短链} 回T退订",
    variables: ["姓氏称谓", "活动简称", "开幕日期", "短链"],
    requiresOptOut: true,
  },
];

/** 完整种子请跑应用内 seedNotificationTemplates；此处为最小兜底 */
const prisma = new PrismaClient();

async function main() {
  // 动态 import 全量种子正文避免重复维护：直接写 SQL upsert 用 packages path
  const { NOTIFICATION_TEMPLATE_SEEDS } = await import(
    "../../../apps/web/src/lib/notification/templates.ts"
  ).catch(() => ({ NOTIFICATION_TEMPLATE_SEEDS: TEMPLATES }));

  for (const t of NOTIFICATION_TEMPLATE_SEEDS) {
    await prisma.notificationTemplate.upsert({
      where: { code: t.code },
      create: {
        code: t.code,
        name: t.name,
        channel: t.channel,
        category: t.category,
        audience: t.audience,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        requiresOptOut: t.requiresOptOut,
        enabled: true,
      },
      update: {
        name: t.name,
        body: t.body,
        subject: t.subject,
        requiresOptOut: t.requiresOptOut,
        enabled: true,
      },
    });
  }
  console.log(`✓ seeded ${NOTIFICATION_TEMPLATE_SEEDS.length} templates`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
