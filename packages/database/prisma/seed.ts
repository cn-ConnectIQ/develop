import "dotenv/config";
import {
  AccountType,
  ActivityType,
  AdminStatus,
  ApplicationStatus,
  BoothStatus,
  EventStatus,
  EventType,
  IntentCategory,
  InviteStatus,
  LeadStatus,
  MemberTier,
  OrgJoinSource,
  OrgStaffRole,
  ParticipantInviteStatus,
  ReviewStatus,
  SignalType,
  StampRallyStatus,
  UserAccountStatus,
  UserRole,
  UserType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/client";
import { seedInteractionDemoData } from "./seed-interactions";

const SEED_PASSWORD = "ConnectIQ2024!";

/** 账号管理员 + 平台管理员手机号 */
const ADMIN_PHONES = [
  "13800000001",
  "13800000002",
  "13800000003",
  "13800000004",
  "13800000005",
  "13800000006",
  "13800000007",
  "13800000008",
] as const;

/** 最终用户手机号 */
const END_USER_PHONES = [
  "13900000001",
  "13900000002",
  "13900000003",
  "13900000004",
  "13900000005",
  "13900000006",
  "13900000007",
  "13900000008",
  "13900000009",
  "13900000010",
] as const;

const SEED_ORG_SLUGS = [
  "saas-growth-institute",
  "cloud-li-exhibitor",
  "china-digital-expo",
  "cloud-crm-tech",
  "connectiq-innovation-hub",
  // 旧版 seed 兼容清理
  "connectiq-org",
  "digital-expo-org",
  "bagevent-org",
] as const;

const SEED_EVENT_SLUGS = [
  "saas-growth-summit-2025",
  "product-growth-salon-beijing",
  "enterprise-digital-expo-2025",
  "innovation-summit-2025",
  "smart-link-industry-expo-2026",
  // 旧版 seed 兼容清理
  "product-salon-2025",
  "connectiq-summit-2026",
  "bagevent-expo-2026",
] as const;

// 登录：13800000001（平台管理员），验证码开发环境控制台输出

const INTENT_TAGS: Array<{
  label: string;
  slug: string;
  category: IntentCategory;
  color: string;
}> = [
  { label: "ERP系统", slug: "erp-system", category: IntentCategory.TRADING, color: "#185FA5" },
  { label: "CRM软件", slug: "crm-software", category: IntentCategory.TRADING, color: "#185FA5" },
  { label: "营销自动化", slug: "marketing-automation", category: IntentCategory.TRADING, color: "#185FA5" },
  { label: "渠道代理商", slug: "channel-agent", category: IntentCategory.TRADING, color: "#185FA5" },
  { label: "SaaS采购", slug: "saas-procurement", category: IntentCategory.TRADING, color: "#185FA5" },
  { label: "天使投资", slug: "angel-investing", category: IntentCategory.INVESTING, color: "#EF9F27" },
  { label: "VC基金", slug: "vc-fund", category: IntentCategory.INVESTING, color: "#EF9F27" },
  { label: "战略投资", slug: "strategic-investing", category: IntentCategory.INVESTING, color: "#EF9F27" },
  { label: "产业基金", slug: "industry-fund", category: IntentCategory.INVESTING, color: "#EF9F27" },
  { label: "渠道合作伙伴", slug: "channel-partner", category: IntentCategory.PARTNERING, color: "#534AB7" },
  { label: "技术集成商", slug: "tech-integrator", category: IntentCategory.PARTNERING, color: "#534AB7" },
  { label: "解决方案合作", slug: "solution-integration", category: IntentCategory.PARTNERING, color: "#534AB7" },
  { label: "生态联盟", slug: "ecosystem-alliance", category: IntentCategory.PARTNERING, color: "#534AB7" },
  { label: "销售总监", slug: "sales-director", category: IntentCategory.RECRUITING, color: "#0F6E56" },
  { label: "产品经理", slug: "product-manager", category: IntentCategory.RECRUITING, color: "#0F6E56" },
  { label: "市场负责人", slug: "marketing-lead", category: IntentCategory.RECRUITING, color: "#0F6E56" },
  { label: "CTO", slug: "cto", category: IntentCategory.RECRUITING, color: "#0F6E56" },
  { label: "B2B营销", slug: "b2b-marketing", category: IntentCategory.NETWORKING, color: "#854F0B" },
  { label: "SaaS从业者", slug: "saas-practitioner", category: IntentCategory.NETWORKING, color: "#854F0B" },
  { label: "产品创业", slug: "product-startup", category: IntentCategory.NETWORKING, color: "#854F0B" },
];

const END_USER_PROFILES = [
  { phone: "13900000001", name: "张伟", company: "未来科技", jobTitle: "CEO", industry: "SaaS", status: UserAccountStatus.COMPLETE },
  { phone: "13900000002", name: "李娜", company: "云端互动", jobTitle: "销售总监", industry: "营销科技", status: UserAccountStatus.COMPLETE },
  { phone: "13900000003", name: "王强", company: "智联会展", jobTitle: "市场负责人", industry: "会展", status: UserAccountStatus.COMPLETE },
  { phone: "13900000004", name: "陈静", company: "数字营销实验室", jobTitle: "产品经理", industry: "MarTech", status: UserAccountStatus.COMPLETE },
  { phone: "13900000005", name: "刘洋", company: "创新工场", jobTitle: "投资经理", industry: "投资", status: UserAccountStatus.COMPLETE },
  { phone: "13900000006", name: "赵敏", company: "星河 SaaS", jobTitle: "运营总监", industry: "SaaS", status: UserAccountStatus.ACTIVE },
  { phone: "13900000007", name: "孙磊", company: "极客营销", jobTitle: "增长负责人", industry: "营销", status: UserAccountStatus.ACTIVE },
  { phone: "13900000008", name: "周婷", company: "企服优选", jobTitle: "采购经理", industry: "企业服务", status: UserAccountStatus.ACTIVE },
  { phone: "13900000009", name: "吴昊", company: "数据驱动科技", jobTitle: "技术总监", industry: "数据", status: UserAccountStatus.ACTIVE },
  { phone: "13900000010", name: "郑琳", company: "品牌加速器", jobTitle: "品牌总监", industry: "品牌", status: UserAccountStatus.ACTIVE },
] as const;

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

function daysAgo(days: number, hours = 10) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

function daysFromNow(days: number, hours = 10) {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
}

async function clearSeedData() {
  const allPhones = [...ADMIN_PHONES, ...END_USER_PHONES];

  const seedUsers = await prisma.user.findMany({
    where: {
      OR: [
        { phone: { in: [...allPhones] } },
        { email: { endsWith: "@connectiq.test" } },
        { email: { endsWith: "@phone.connectiq.local" } },
      ],
    },
    select: { id: true },
  });
  const seedUserIds = seedUsers.map((u) => u.id);

  await prisma.event.deleteMany({
    where: {
      OR: [
        { slug: { in: [...SEED_EVENT_SLUGS] } },
        ...(seedUserIds.length > 0
          ? [{ organizerId: { in: seedUserIds } }]
          : []),
      ],
    },
  });

  await prisma.organization.deleteMany({
    where: { slug: { in: [...SEED_ORG_SLUGS] } },
  });

  if (seedUserIds.length > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: seedUserIds } },
    });
  }
}

async function upsertUser(params: {
  phone: string;
  name: string;
  userType: UserType;
  accountStatus?: UserAccountStatus;
  company?: string;
  industry?: string;
  jobTitle?: string;
  roles?: UserRole[];
}) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const email = phoneToEmail(params.phone);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      phone: params.phone,
      name: params.name,
      userType: params.userType,
      passwordHash,
    },
    create: {
      email,
      phone: params.phone,
      name: params.name,
      passwordHash,
      userType: params.userType,
    },
  });

  if (params.accountStatus) {
    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        accountStatus: params.accountStatus,
        company: params.company,
        industry: params.industry,
        valueProposition: params.jobTitle,
      },
      create: {
        userId: user.id,
        accountStatus: params.accountStatus,
        company: params.company,
        industry: params.industry,
        valueProposition: params.jobTitle,
      },
    });
  }

  if (params.roles?.length) {
    for (const role of params.roles) {
      const existing = await prisma.userRoleAssignment.findFirst({
        where: { userId: user.id, role },
      });
      if (!existing) {
        await prisma.userRoleAssignment.create({
          data: { userId: user.id, role },
        });
      }
    }
  }

  return user;
}

async function createApprovedAccountAdmin(params: {
  phone: string;
  name: string;
  org: {
    name: string;
    slug: string;
    accountType: AccountType;
    bio?: string;
    industry?: string;
    companySize?: string;
    headquarters?: string;
    foundedYear?: number;
    website?: string;
    contactEmail?: string;
  };
}) {
  const admin = await upsertUser({
    phone: params.phone,
    name: params.name,
    userType: UserType.ACCOUNT_ADMIN,
    accountStatus: UserAccountStatus.COMPLETE,
  });

  const orgData = {
    name: params.org.name,
    accountType: params.org.accountType,
    bio: params.org.bio,
    industry: params.org.industry,
    companySize: params.org.companySize,
    headquarters: params.org.headquarters,
    foundedYear: params.org.foundedYear,
    website: params.org.website,
    contactEmail: params.org.contactEmail ?? admin.email,
    isVerified: true,
    adminStatus: AdminStatus.APPROVED,
    ownerId: admin.id,
  };

  const org = await prisma.organization.upsert({
    where: { slug: params.org.slug },
    update: orgData,
    create: {
      slug: params.org.slug,
      ...orgData,
    },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { orgId: org.id },
  });

  await prisma.orgStaff.upsert({
    where: { orgId_userId: { orgId: org.id, userId: admin.id } },
    update: { role: OrgStaffRole.OWNER, status: InviteStatus.ACCEPTED },
    create: {
      orgId: org.id,
      userId: admin.id,
      role: OrgStaffRole.OWNER,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });

  for (const role of [
    UserRole.ORGANIZER,
    UserRole.EXPO_ORGANIZER,
    UserRole.EXHIBITOR,
  ]) {
    const existing = await prisma.userRoleAssignment.findFirst({
      where: { userId: admin.id, role, entityId: null },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({
        data: { userId: admin.id, role },
      });
    }
  }

  await prisma.organizerApplication.upsert({
    where: { orgId: org.id },
    update: {
      status: ApplicationStatus.APPROVED,
      orgId: org.id,
      reviewedAt: new Date(),
    },
    create: {
      userId: admin.id,
      orgId: org.id,
      accountType: params.org.accountType,
      orgName: params.org.name,
      contactName: params.name,
      contactEmail: admin.email,
      contactPhone: params.phone,
      description: `${params.org.name} 官方账号`,
      status: ApplicationStatus.APPROVED,
      reviewedAt: new Date(),
      submittedAt: daysAgo(30),
    },
  });

  return { admin, org };
}

async function main() {
  console.log("🌱 ConnectIQ 三层角色测试数据 seed\n");

  await clearSeedData();
  const now = new Date();

  // ── 平台管理员 ──────────────────────────────────────────────
  const platformAdmin = await upsertUser({
    phone: "13800000001",
    name: "平台管理员",
    userType: UserType.PLATFORM_ADMIN,
    accountStatus: UserAccountStatus.COMPLETE,
    company: "ConnectIQ",
    industry: "活动科技",
    roles: [UserRole.PLATFORM_ADMIN],
  });
  console.log("✓ 平台管理员 13800000001");

  // ── ① 会议主办方 ────────────────────────────────────────────
  const { admin: confAdmin, org: confOrg } = await createApprovedAccountAdmin({
    phone: "13800000002",
    name: "李经理",
    org: {
      name: "SaaS 增长研究院",
      slug: "saas-growth-institute",
      accountType: AccountType.CONFERENCE_ORGANIZER,
      bio: "专注于 SaaS 行业的增长研究与实践，每年举办多场行业峰会",
    },
  });

  const summitEvent = await prisma.event.upsert({
    where: { slug: "saas-growth-summit-2025" },
    update: {
      status: EventStatus.LIVE,
      reviewStatus: ReviewStatus.LIVE,
    },
    create: {
      name: "SaaS 增长峰会 2025",
      slug: "saas-growth-summit-2025",
      type: EventType.CONFERENCE,
      activityType: ActivityType.CONFERENCE,
      status: EventStatus.LIVE,
      reviewStatus: ReviewStatus.LIVE,
      description: "聚焦 B2B SaaS 增长策略的行业峰会",
      location: "上海 · 张江科学会堂",
      startDate: daysAgo(1),
      endDate: daysFromNow(2),
      organizerId: confAdmin.id,
      orgId: confOrg.id,
      settings: { create: { key: "event_category", value: "SUMMIT" } },
    },
  });

  const salonEvent = await prisma.event.upsert({
    where: { slug: "product-growth-salon-beijing" },
    update: {
      status: EventStatus.PUBLISHED,
      reviewStatus: ReviewStatus.PUBLISHED,
    },
    create: {
      name: "产品增长沙龙（北京）",
      slug: "product-growth-salon-beijing",
      type: EventType.CONFERENCE,
      activityType: ActivityType.CONFERENCE,
      status: EventStatus.PUBLISHED,
      reviewStatus: ReviewStatus.PUBLISHED,
      description: "小型闭门产品增长交流沙龙",
      location: "北京 · 798 艺术区",
      startDate: daysFromNow(14),
      endDate: daysFromNow(14, 18),
      organizerId: confAdmin.id,
      orgId: confOrg.id,
      settings: { create: { key: "event_category", value: "SALON" } },
    },
  });

  await prisma.organization.update({
    where: { id: confOrg.id },
    data: { eventCount: 2 },
  });

  console.log("✓ ① 会议主办方 13800000002 + 2 场活动");

  // 同一个用户（李经理）同时也是参展商（多身份切换测试）
  const liExhibitorOrg = await prisma.organization.upsert({
    where: { slug: "cloud-li-exhibitor" },
    update: {
      name: "李经理参展部",
      accountType: AccountType.EXHIBITOR,
      isVerified: true,
      adminStatus: AdminStatus.APPROVED,
      bio: "专注 SaaS 工具参展推广",
    },
    create: {
      name: "李经理参展部",
      slug: "cloud-li-exhibitor",
      accountType: AccountType.EXHIBITOR,
      isVerified: true,
      adminStatus: AdminStatus.APPROVED,
      bio: "专注 SaaS 工具参展推广",
      // ownerId 不写入：confOrg 已占用该 User 的 owner_id（列有唯一约束）
    },
  });

  await prisma.orgStaff.upsert({
    where: {
      orgId_userId: { orgId: liExhibitorOrg.id, userId: confAdmin.id },
    },
    update: { role: OrgStaffRole.OWNER, status: InviteStatus.ACCEPTED },
    create: {
      orgId: liExhibitorOrg.id,
      userId: confAdmin.id,
      role: OrgStaffRole.OWNER,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });

  await prisma.organizerApplication.upsert({
    where: { orgId: liExhibitorOrg.id },
    update: {
      status: ApplicationStatus.APPROVED,
      reviewedAt: new Date(),
    },
    create: {
      userId: confAdmin.id,
      orgId: liExhibitorOrg.id,
      accountType: AccountType.EXHIBITOR,
      orgName: "李经理参展部",
      contactName: "李经理",
      contactEmail: confAdmin.email,
      contactPhone: "13800000002",
      description: "以参展商身份参加展会，采集潜在客户",
      status: ApplicationStatus.APPROVED,
      reviewedAt: new Date(),
      submittedAt: daysAgo(20),
    },
  });

  // orgId 保持指向会议主办方组织（createApprovedAccountAdmin 已设置），不改动

  // ── ② 展览主办方 ────────────────────────────────────────────
  const { admin: expoAdmin, org: expoOrg } = await createApprovedAccountAdmin({
    phone: "13800000003",
    name: "王总监",
    org: {
      name: "中国企业数字化展览集团",
      slug: "china-digital-expo",
      accountType: AccountType.EXPO_ORGANIZER,
    },
  });

  const expoEvent = await prisma.event.upsert({
    where: { slug: "enterprise-digital-expo-2025" },
    update: {
      status: EventStatus.PUBLISHED,
      reviewStatus: ReviewStatus.PUBLISHED,
    },
    create: {
      name: "2025 企业数字化展览会",
      slug: "enterprise-digital-expo-2025",
      type: EventType.EXPO,
      activityType: ActivityType.EXPO,
      status: EventStatus.PUBLISHED,
      reviewStatus: ReviewStatus.PUBLISHED,
      description: "企业数字化解决方案展览",
      location: "深圳 · 会展中心",
      startDate: daysFromNow(30),
      endDate: daysFromNow(33),
      organizerId: expoAdmin.id,
      orgId: expoOrg.id,
      settings: { create: { key: "event_category", value: "EXPO" } },
    },
  });

  // IntentTag × 20（挂在展会活动上）
  for (const [index, tag] of INTENT_TAGS.entries()) {
    await prisma.intentTag.upsert({
      where: {
        eventId_slug: { eventId: expoEvent.id, slug: tag.slug },
      },
      update: {
        label: tag.label,
        category: tag.category,
        color: tag.color,
        sortOrder: index + 1,
      },
      create: {
        eventId: expoEvent.id,
        label: tag.label,
        slug: tag.slug,
        category: tag.category,
        color: tag.color,
        sortOrder: index + 1,
      },
    });
  }

  console.log("✓ ② 展览主办方 13800000003 + 展会 + 20 IntentTag");

  // ── ③ 参展商 ────────────────────────────────────────────────
  const { admin: exhibitorAdmin, org: exhibitorOrg } = await createApprovedAccountAdmin({
      phone: "13800000004",
      name: "张销售",
      org: {
        name: "云端 CRM 科技有限公司",
        slug: "cloud-crm-tech",
        accountType: AccountType.EXHIBITOR,
      },
    });

  const expoHall = await prisma.expoHall.create({
    data: { eventId: expoEvent.id, name: "A 馆", floor: "1F" },
  });

  // 李经理（13800000002）在「2025 企业数字化展览会」的参展商展位
  await prisma.exhibitorBooth.upsert({
    where: { id: "seed-booth-li-exhibitor" },
    update: {
      companyOrgId: liExhibitorOrg.id,
      operatorUserId: confAdmin.id,
      status: BoothStatus.BOOKED,
    },
    create: {
      id: "seed-booth-li-exhibitor",
      name: "李经理 SaaS 展位",
      code: "B-08",
      eventId: expoEvent.id,
      hallId: expoHall.id,
      companyOrgId: liExhibitorOrg.id,
      operatorUserId: confAdmin.id,
      status: BoothStatus.BOOKED,
      positionData: { x: 32, y: 8, width: 5, height: 5 },
    },
  });

  console.log("✅ 多身份测试数据创建完成");
  console.log("  李经理（13800000002）拥有两个 Organization：");
  console.log("  - SaaS 增长研究院（CONFERENCE_ORGANIZER）← 默认激活");
  console.log("  - 李经理参展部（EXHIBITOR）← 需要手动切换");

  await prisma.exhibitorBooth.upsert({
    where: { eventId_code: { eventId: expoEvent.id, code: "A-01" } },
    update: {
      companyOrgId: exhibitorOrg.id,
      operatorUserId: exhibitorAdmin.id,
      status: BoothStatus.OCCUPIED,
    },
    create: {
      name: "云端 CRM 主展位",
      code: "A-01",
      eventId: expoEvent.id,
      hallId: expoHall.id,
      companyOrgId: exhibitorOrg.id,
      operatorUserId: exhibitorAdmin.id,
      status: BoothStatus.OCCUPIED,
      positionData: { x: 10, y: 12, width: 8, height: 6 },
    },
  });

  await prisma.exhibitorBooth.upsert({
    where: { eventId_code: { eventId: expoEvent.id, code: "A-02" } },
    update: {
      companyOrgId: exhibitorOrg.id,
      operatorUserId: exhibitorAdmin.id,
      status: BoothStatus.BOOKED,
    },
    create: {
      name: "云端 CRM 体验区",
      code: "A-02",
      eventId: expoEvent.id,
      hallId: expoHall.id,
      companyOrgId: exhibitorOrg.id,
      operatorUserId: exhibitorAdmin.id,
      status: BoothStatus.BOOKED,
      positionData: { x: 20, y: 12, width: 6, height: 6 },
    },
  });

  console.log("✓ ③ 参展商 13800000004 + 2 个展位");

  // ── ⑦ 新模型：统一组织（ORGANIZATION + 多角色 + 公开主页）──
  const { admin: unifiedAdmin, org: unifiedOrg } =
    await createApprovedAccountAdmin({
      phone: "13800000008",
      name: "陈主编",
      org: {
        name: "ConnectIQ 创新中心",
        slug: "connectiq-innovation-hub",
        accountType: AccountType.ORGANIZATION,
        bio: "连接会议、展览与参展生态的活动科技组织，支持一站式活动运营",
        industry: "信息技术",
        companySize: "11-50",
        headquarters: "上海市 · 徐汇区",
        foundedYear: 2019,
        website: "https://connectiq.cn",
        contactEmail: "contact@connectiq.cn",
      },
    });

  await prisma.event.upsert({
    where: { slug: "innovation-summit-2025" },
    update: {
      status: EventStatus.PUBLISHED,
      reviewStatus: ReviewStatus.PUBLISHED,
      orgId: unifiedOrg.id,
    },
    create: {
      name: "创新活动运营峰会 2025",
      slug: "innovation-summit-2025",
      type: EventType.CONFERENCE,
      activityType: ActivityType.CONFERENCE,
      status: EventStatus.PUBLISHED,
      reviewStatus: ReviewStatus.PUBLISHED,
      description: "统一组织模型下的会议活动示例",
      location: "上海 · 漕河泾",
      startDate: daysFromNow(21),
      endDate: daysFromNow(22),
      organizerId: unifiedAdmin.id,
      orgId: unifiedOrg.id,
    },
  });

  const hostedExpoEvent = await prisma.event.upsert({
    where: { slug: "smart-link-industry-expo-2026" },
    update: {
      status: EventStatus.LIVE,
      reviewStatus: ReviewStatus.LIVE,
      orgId: unifiedOrg.id,
    },
    create: {
      name: "智链未来产业博览会 2026",
      slug: "smart-link-industry-expo-2026",
      type: EventType.EXPO,
      activityType: ActivityType.EXPO,
      status: EventStatus.LIVE,
      reviewStatus: ReviewStatus.LIVE,
      description:
        "ConnectIQ 创新中心主办的 B2B 产业展会，覆盖智能制造、企业服务与 MarTech 三大展区",
      location: "上海 · 国家会展中心（虹桥）",
      startDate: daysAgo(1),
      endDate: daysFromNow(2),
      organizerId: unifiedAdmin.id,
      orgId: unifiedOrg.id,
      settings: { create: { key: "event_category", value: "EXPO" } },
    },
  });

  const hostedExpoHall = await prisma.expoHall.upsert({
    where: { id: "seed-hall-smart-link-expo" },
    update: { name: "1 号馆 · 智链主展", floor: "1F" },
    create: {
      id: "seed-hall-smart-link-expo",
      eventId: hostedExpoEvent.id,
      name: "1 号馆 · 智链主展",
      floor: "1F",
    },
  });

  for (const [index, tag] of INTENT_TAGS.slice(0, 8).entries()) {
    await prisma.intentTag.upsert({
      where: {
        eventId_slug: { eventId: hostedExpoEvent.id, slug: tag.slug },
      },
      update: {
        label: tag.label,
        category: tag.category,
        color: tag.color,
        sortOrder: index + 1,
      },
      create: {
        eventId: hostedExpoEvent.id,
        label: tag.label,
        slug: tag.slug,
        category: tag.category,
        color: tag.color,
        sortOrder: index + 1,
      },
    });
  }

  const hostedBoothSpecs = [
    {
      code: "A-101",
      name: "云端 CRM 科技",
      orgId: exhibitorOrg.id,
      operatorId: exhibitorAdmin.id,
      x: 8,
      y: 10,
    },
    {
      code: "A-102",
      name: "李经理 SaaS 工具",
      orgId: liExhibitorOrg.id,
      operatorId: confAdmin.id,
      x: 22,
      y: 10,
    },
    {
      code: "A-103",
      name: "数字营销实验室",
      orgId: expoOrg.id,
      operatorId: expoAdmin.id,
      x: 36,
      y: 10,
    },
  ] as const;

  for (const spec of hostedBoothSpecs) {
    await prisma.exhibitorBooth.upsert({
      where: {
        eventId_code: { eventId: hostedExpoEvent.id, code: spec.code },
      },
      update: {
        companyOrgId: spec.orgId,
        operatorUserId: spec.operatorId,
        status: BoothStatus.OCCUPIED,
      },
      create: {
        name: spec.name,
        code: spec.code,
        eventId: hostedExpoEvent.id,
        hallId: hostedExpoHall.id,
        companyOrgId: spec.orgId,
        operatorUserId: spec.operatorId,
        status: BoothStatus.OCCUPIED,
        positionData: { x: spec.x, y: spec.y, width: 6, height: 5 },
        positionX: spec.x,
        positionY: spec.y,
        hallLabel: "1 号馆",
      },
    });
  }

  await prisma.ticketType.upsert({
    where: { id: "seed-ticket-smart-expo-vip" },
    update: { name: "VIP 通票", price: 0, quota: 200 },
    create: {
      id: "seed-ticket-smart-expo-vip",
      eventId: hostedExpoEvent.id,
      name: "VIP 通票",
      price: 0,
      quota: 200,
    },
  });

  await prisma.ticketType.upsert({
    where: { id: "seed-ticket-smart-expo-standard" },
    update: { name: "标准观众票", price: 0, quota: 800 },
    create: {
      id: "seed-ticket-smart-expo-standard",
      eventId: hostedExpoEvent.id,
      name: "标准观众票",
      price: 0,
      quota: 800,
    },
  });

  const hostedAttendeeSpecs = [
    { id: "seed-part-smart-expo-1", name: "林峰", company: "智造科技", jobTitle: "采购总监" },
    { id: "seed-part-smart-expo-2", name: "何雨", company: "云链物流", jobTitle: "运营副总" },
    { id: "seed-part-smart-expo-3", name: "唐悦", company: "新锐 MarTech", jobTitle: "市场负责人" },
    { id: "seed-part-smart-expo-4", name: "宋航", company: "华东工业集团", jobTitle: "信息化主管" },
    { id: "seed-part-smart-expo-5", name: "许曼", company: "跨境电商业态联盟", jobTitle: "合伙人" },
  ] as const;

  for (const spec of hostedAttendeeSpecs) {
    await prisma.participant.upsert({
      where: { id: spec.id },
      update: {
        name: spec.name,
        company: spec.company,
        jobTitle: spec.jobTitle,
        inviteStatus: ParticipantInviteStatus.ACTIVATED,
      },
      create: {
        id: spec.id,
        eventId: hostedExpoEvent.id,
        name: spec.name,
        company: spec.company,
        jobTitle: spec.jobTitle,
        email: `${spec.id}@seed.connectiq.local`,
        inviteStatus: ParticipantInviteStatus.ACTIVATED,
      },
    });
  }

  for (const participantId of hostedAttendeeSpecs.slice(0, 3).map((s) => s.id)) {
    await prisma.checkIn.upsert({
      where: { id: `seed-checkin-${participantId}` },
      update: { checkedInAt: daysAgo(0, 2) },
      create: {
        id: `seed-checkin-${participantId}`,
        eventId: hostedExpoEvent.id,
        participantId,
        method: "qr",
        checkedInAt: daysAgo(0, 2),
      },
    });
  }

  const digitalExpoHall = await prisma.expoHall.findFirst({
    where: { eventId: expoEvent.id },
  });

  if (digitalExpoHall) {
    await prisma.exhibitorBooth.upsert({
      where: {
        eventId_code: { eventId: expoEvent.id, code: "C-18" },
      },
      update: {
        companyOrgId: unifiedOrg.id,
        operatorUserId: unifiedAdmin.id,
        status: BoothStatus.OCCUPIED,
      },
      create: {
        name: "ConnectIQ 创新展台",
        code: "C-18",
        eventId: expoEvent.id,
        hallId: digitalExpoHall.id,
        companyOrgId: unifiedOrg.id,
        operatorUserId: unifiedAdmin.id,
        status: BoothStatus.OCCUPIED,
        positionData: { x: 48, y: 18, width: 7, height: 6 },
        positionX: 48,
        positionY: 18,
        hallLabel: "A 馆",
      },
    });
  }

  const participatedAttendeeSpecs = [
    { id: "seed-part-digital-expo-u1", name: "马晨", company: "华东智造", jobTitle: "CTO" },
    { id: "seed-part-digital-expo-u2", name: "冯莉", company: "企服优选", jobTitle: "采购经理" },
    { id: "seed-part-digital-expo-u3", name: "韩冰", company: "极客营销", jobTitle: "增长负责人" },
    { id: "seed-part-digital-expo-u4", name: "曹阳", company: "数据驱动科技", jobTitle: "产品总监" },
  ] as const;

  for (const spec of participatedAttendeeSpecs) {
    await prisma.participant.upsert({
      where: { id: spec.id },
      update: {
        name: spec.name,
        company: spec.company,
        jobTitle: spec.jobTitle,
      },
      create: {
        id: spec.id,
        eventId: expoEvent.id,
        name: spec.name,
        company: spec.company,
        jobTitle: spec.jobTitle,
        email: `${spec.id}@seed.connectiq.local`,
      },
    });
  }

  const unifiedParticipationBooth = await prisma.exhibitorBooth.findFirst({
    where: { eventId: expoEvent.id, code: "C-18" },
  });

  if (unifiedParticipationBooth) {
    const leadSpecs = [
      {
        id: "seed-lead-unified-expo-1",
        participantId: participatedAttendeeSpecs[0].id,
        status: LeadStatus.NEW,
        intentGrade: "A",
      },
      {
        id: "seed-lead-unified-expo-2",
        participantId: participatedAttendeeSpecs[1].id,
        status: LeadStatus.CONTACTED,
        intentGrade: "B",
      },
      {
        id: "seed-lead-unified-expo-3",
        participantId: participatedAttendeeSpecs[2].id,
        status: LeadStatus.QUALIFIED,
        intentGrade: "A",
      },
      {
        id: "seed-lead-unified-expo-4",
        participantId: participatedAttendeeSpecs[3].id,
        status: LeadStatus.NEW,
        intentGrade: "C",
      },
    ] as const;

    for (const spec of leadSpecs) {
      await prisma.lead.upsert({
        where: { id: spec.id },
        update: {
          status: spec.status,
          intentGrade: spec.intentGrade,
          notes: "Seed 测试线索 — 扫码采集",
        },
        create: {
          id: spec.id,
          boothId: unifiedParticipationBooth.id,
          participantId: spec.participantId,
          status: spec.status,
          intentGrade: spec.intentGrade,
          notes: "Seed 测试线索 — 扫码采集",
        },
      });
    }
  }

  await prisma.organization.update({
    where: { id: unifiedOrg.id },
    data: { eventCount: 2 },
  });

  console.log(
    "✓ ⑦ 统一组织 13800000008 → 会议 + 主办展会「智链未来产业博览会 2026」+ 参展「2025 企业数字化展览会」",
  );

  // ── ④⑤ 待审核账号管理员 ─────────────────────────────────────
  const pendingConf = await upsertUser({
    phone: "13800000005",
    name: "钱老板",
    userType: UserType.ACCOUNT_ADMIN,
    accountStatus: UserAccountStatus.ACTIVE,
  });

  const pendingExpo = await upsertUser({
    phone: "13800000006",
    name: "孙经理",
    userType: UserType.ACCOUNT_ADMIN,
    accountStatus: UserAccountStatus.ACTIVE,
  });

  for (const spec of [
    {
      user: pendingConf,
      orgName: "医疗健康论坛联盟",
      contactName: "钱老板",
      phone: "13800000005",
      description:
        "专注医疗健康行业论坛与峰会，希望使用 ConnectIQ 统一管理会议与展览活动，面向医疗机构与产业伙伴提供全年活动运营服务。",
      submittedAt: daysAgo(2),
    },
    {
      user: pendingExpo,
      orgName: "新能源汽车展览集团",
      contactName: "孙经理",
      phone: "13800000006",
      description:
        "新能源汽车主题展览与论坛主办方，计划每年举办大型展会并管理参展商与买家资源，需要完整的活动管理与用户池能力。",
      submittedAt: daysAgo(1),
    },
  ] as const) {
    const existing = await prisma.organizerApplication.findFirst({
      where: {
        userId: spec.user.id,
        orgName: spec.orgName,
        status: ApplicationStatus.PENDING,
      },
    });
    if (existing) {
      await prisma.organizerApplication.update({
        where: { id: existing.id },
        data: { status: ApplicationStatus.PENDING, accountType: AccountType.ORGANIZATION },
      });
    } else {
      await prisma.organizerApplication.create({
        data: {
          userId: spec.user.id,
          accountType: AccountType.ORGANIZATION,
          orgName: spec.orgName,
          contactName: spec.contactName,
          contactEmail: spec.user.email,
          contactPhone: spec.phone,
          description: spec.description,
          status: ApplicationStatus.PENDING,
          submittedAt: spec.submittedAt,
        },
      });
    }
  }

  console.log("✓ ④⑤ 待审核账号 13800000005 / 13800000006");

  // ── ⑥ 被拒绝账号管理员 ──────────────────────────────────────
  const rejectedAdmin = await upsertUser({
    phone: "13800000007",
    name: "周申请人",
    userType: UserType.ACCOUNT_ADMIN,
    accountStatus: UserAccountStatus.ACTIVE,
  });

  const rejectedExisting = await prisma.organizerApplication.findFirst({
    where: {
      userId: rejectedAdmin.id,
      status: ApplicationStatus.REJECTED,
    },
  });
  if (rejectedExisting) {
    await prisma.organizerApplication.update({
      where: { id: rejectedExisting.id },
      data: {
        status: ApplicationStatus.REJECTED,
        rejectionReason:
          "申请说明信息不完整，请补充组织背景说明和举办活动经历后重新申请",
      },
    });
  } else {
    await prisma.organizerApplication.create({
      data: {
        userId: rejectedAdmin.id,
        accountType: AccountType.ORGANIZATION,
        orgName: "未命名活动组织",
        contactName: "周申请人",
        contactEmail: rejectedAdmin.email,
        contactPhone: "13800000007",
        description:
          "申请信息过于简略，未说明组织背景与活动计划，无法完成资质审核。请补充至少 100 字的组织介绍与使用场景说明后重新提交。",
        status: ApplicationStatus.REJECTED,
        rejectionReason:
          "申请说明信息不完整，请补充组织背景说明和举办活动经历后重新申请",
        reviewedAt: daysAgo(3),
        submittedAt: daysAgo(7),
      },
    });
  }

  console.log("✓ ⑥ 被拒绝账号 13800000007");

  // ── 最终用户 × 10 ───────────────────────────────────────────
  const endUsers = [];
  for (const profile of END_USER_PROFILES) {
    const user = await upsertUser({
      phone: profile.phone,
      name: profile.name,
      userType: UserType.END_USER,
      accountStatus: profile.status,
      company: profile.company,
      industry: profile.industry,
      jobTitle: profile.jobTitle,
    });
    endUsers.push(user);
  }
  console.log("✓ 最终用户 × 10（5 COMPLETE + 5 ACTIVE）");

  const unifiedBoothForSignals = await prisma.exhibitorBooth.findFirst({
    where: { eventId: expoEvent.id, code: "C-18" },
  });
  if (unifiedBoothForSignals) {
    await prisma.boothVisitSignal.createMany({
      data: endUsers.slice(5, 9).map((user, index) => ({
        userId: user.id,
        eventId: expoEvent.id,
        signalType: SignalType.BOOTH_SCAN,
        entityId: unifiedBoothForSignals.id,
        entityType: "BOOTH",
        payload: { source: "seed_unified_booth", index },
      })),
      skipDuplicates: true,
    });
  }

  // ── OrgMember：5 人 → SaaS 增长研究院 ───────────────────────
  const confMemberSpecs: Array<{
    userIndex: number;
    joinSource: OrgJoinSource;
    sourceEventId?: string;
    isFollowing?: boolean;
    tier: MemberTier;
    eventCount: number;
  }> = [
    { userIndex: 0, joinSource: OrgJoinSource.PARTICIPATED_EVENT, sourceEventId: summitEvent.id, tier: MemberTier.VIP, eventCount: 4 },
    { userIndex: 1, joinSource: OrgJoinSource.PARTICIPATED_EVENT, sourceEventId: summitEvent.id, tier: MemberTier.ACTIVE, eventCount: 2 },
    { userIndex: 2, joinSource: OrgJoinSource.PARTICIPATED_EVENT, sourceEventId: salonEvent.id, tier: MemberTier.ACTIVE, eventCount: 2 },
    { userIndex: 3, joinSource: OrgJoinSource.INVITED, tier: MemberTier.REGULAR, eventCount: 1 },
    { userIndex: 4, joinSource: OrgJoinSource.FOLLOWED, isFollowing: true, tier: MemberTier.REGULAR, eventCount: 0 },
  ];

  for (const spec of confMemberSpecs) {
    const user = endUsers[spec.userIndex]!;
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: confOrg.id, userId: user.id } },
      update: {
        joinSource: spec.joinSource,
        sourceEventId: spec.sourceEventId ?? null,
        isFollowing: spec.isFollowing ?? false,
        tier: spec.tier,
        eventCount: spec.eventCount,
        lastActiveAt: daysAgo(1),
      },
      create: {
        orgId: confOrg.id,
        userId: user.id,
        joinSource: spec.joinSource,
        sourceEventId: spec.sourceEventId,
        isFollowing: spec.isFollowing ?? false,
        tier: spec.tier,
        eventCount: spec.eventCount,
        lastActiveAt: daysAgo(1),
        firstSeenAt: daysAgo(30),
      },
    });
  }

  // ── OrgMember：3 人 → 数字化展览集团 ─────────────────────────
  const expoMemberSpecs: Array<{
    userIndex: number;
    joinSource: OrgJoinSource;
    tier: MemberTier;
    eventCount: number;
  }> = [
    { userIndex: 5, joinSource: OrgJoinSource.LEAD_CAPTURED, tier: MemberTier.REGULAR, eventCount: 1 },
    { userIndex: 6, joinSource: OrgJoinSource.LEAD_CAPTURED, tier: MemberTier.REGULAR, eventCount: 1 },
    { userIndex: 7, joinSource: OrgJoinSource.QR_SCANNED, tier: MemberTier.REGULAR, eventCount: 1 },
  ];

  for (const spec of expoMemberSpecs) {
    const user = endUsers[spec.userIndex]!;
    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: expoOrg.id, userId: user.id } },
      update: {
        joinSource: spec.joinSource,
        sourceEventId: expoEvent.id,
        tier: spec.tier,
        eventCount: spec.eventCount,
        lastActiveAt: daysAgo(2),
      },
      create: {
        orgId: expoOrg.id,
        userId: user.id,
        joinSource: spec.joinSource,
        sourceEventId: expoEvent.id,
        tier: spec.tier,
        eventCount: spec.eventCount,
        lastActiveAt: daysAgo(2),
        firstSeenAt: daysAgo(14),
      },
    });
  }

  await prisma.organization.update({
    where: { id: confOrg.id },
    data: { memberCount: 5, followerCount: 1 },
  });
  await prisma.organization.update({
    where: { id: expoOrg.id },
    data: { memberCount: 3, eventCount: 1 },
  });

  console.log("✓ OrgMember：5 人 → 研究院，3 人 → 展览集团");

  // ── 集章打卡 + 展位坐标 + 行为信号 ──────────────────────────
  const expoBooths = await prisma.exhibitorBooth.findMany({
    where: { eventId: expoEvent.id },
    orderBy: { code: "asc" },
  });

  for (const booth of expoBooths) {
    const pd =
      booth.positionData && typeof booth.positionData === "object"
        ? (booth.positionData as { x?: number; y?: number })
        : null;
    await prisma.exhibitorBooth.update({
      where: { id: booth.id },
      data: {
        positionX: pd?.x ?? booth.positionX,
        positionY: pd?.y ?? booth.positionY,
        hallLabel: "A 馆",
      },
    });
  }

  const boothIds = expoBooths.map((b) => b.id);
  if (boothIds.length > 0) {
    await prisma.stampRally.upsert({
      where: { id: "seed-stamp-rally-expo" },
      update: {
        status: StampRallyStatus.ACTIVE,
        boothIds,
        totalBooths: boothIds.length,
      },
      create: {
        id: "seed-stamp-rally-expo",
        eventId: expoEvent.id,
        createdById: expoAdmin.id,
        name: "2025 展会集章之旅",
        description: "逛展集章，兑换好礼",
        prize: "Apple AirPods Pro",
        requiredCount: 2,
        totalBooths: boothIds.length,
        boothIds,
        status: StampRallyStatus.ACTIVE,
      },
    });
  }

  const demoAttendee = endUsers[0];
  const scanBooth = expoBooths[0];
  if (demoAttendee && scanBooth) {
    await prisma.boothVisitSignal.createMany({
      data: [
        {
          userId: demoAttendee.id,
          eventId: expoEvent.id,
          signalType: SignalType.BOOTH_SCAN,
          entityId: scanBooth.id,
          entityType: "BOOTH",
          payload: { source: "seed" },
        },
        {
          userId: demoAttendee.id,
          eventId: expoEvent.id,
          signalType: SignalType.BOOTH_SCAN,
          entityId: scanBooth.id,
          entityType: "BOOTH",
          payload: { source: "seed_repeat" },
        },
      ],
      skipDuplicates: true,
    });
  }

  console.log("✓ 集章路线 + 展位坐标 + BoothVisitSignal 示例数据");

  // ── 互动演示数据（Poll / Lottery / Session 全类型）──────────
  const hostedBoothA101 = await prisma.exhibitorBooth.findFirst({
    where: { eventId: hostedExpoEvent.id, code: "A-101" },
  });
  const unifiedBoothC18 = await prisma.exhibitorBooth.findFirst({
    where: { eventId: expoEvent.id, code: "C-18" },
  });
  const interactionMeta = await seedInteractionDemoData({
    hostedExpoEventId: hostedExpoEvent.id,
    expoEventId: expoEvent.id,
    summitEventId: summitEvent.id,
    unifiedAdminId: unifiedAdmin.id,
    expoAdminId: expoAdmin.id,
    confAdminId: confAdmin.id,
    endUserIds: endUsers.map((u) => u.id),
    hostedParticipantIds: hostedAttendeeSpecs.map((s) => s.id),
    expoParticipantIds: participatedAttendeeSpecs.map((s) => s.id),
    hostedBoothA101Id: hostedBoothA101?.id,
    unifiedBoothC18Id: unifiedBoothC18?.id,
    unifiedOrgId: unifiedOrg.id,
  });
  console.log(
    `✓ 互动演示数据：Poll×6 + Lottery×5 + Session（扫码码 ${interactionMeta.sessionCodes.hostedPoll} 等）`,
  );

  // ── 汇总 ────────────────────────────────────────────────────
  console.log("\n✅ Seed 完成\n");
  console.log("── 账号密码登录（推荐）──");
  console.log(`  密码（全部账号）: ${SEED_PASSWORD}`);
  console.log("  邮箱格式: {手机号}@phone.connectiq.local");
  console.log("  平台管理员:     13800000001@phone.connectiq.local");
  console.log("  会议主办方:     13800000002@phone.connectiq.local");
  console.log("  展览主办方:     13800000003@phone.connectiq.local");
  console.log("  参展商:         13800000004@phone.connectiq.local");
  console.log("  统一组织:       13800000008@phone.connectiq.local");
  console.log("\n── 手机号验证码登录 ──");
  console.log("  平台管理员:     13800000001");
  console.log("  会议主办方:     13800000002  李经理");
  console.log("  展览主办方:     13800000003  王总监");
  console.log("  参展商:         13800000004  张销售");
  console.log("  统一组织:       13800000008  陈主编  → /org/connectiq-innovation-hub");
  console.log("  待审核:         13800000005 / 13800000006");
  console.log("  已拒绝:         13800000007");
  console.log("\n── 活动 ──");
  console.log(`  LIVE:      ${summitEvent.name}`);
  console.log(`  PUBLISHED: ${salonEvent.name}`);
  console.log(`  PUBLISHED: ${expoEvent.name}`);
  console.log("\n── 数据量 ──");
  console.log("  Organization: 5（含 ORGANIZATION 统一组织 + 李经理双身份）");
  console.log("  OrganizerApplication: 4 APPROVED + 2 PENDING + 1 REJECTED");
  console.log("  END_USER: 10");
  console.log("  OrgMember: 8");
  console.log("  IntentTag: 20");
  console.log("  Booth: 3");
  console.log("  StampRally: 1");
  console.log("  BoothVisitSignal: 示例");
  console.log("  互动 Poll/Lottery/Session: 见 seed-interactions.ts");
  console.log(`  扫码演示: /i/${interactionMeta.sessionCodes.hostedPoll}（主办展会投票）`);
  console.log(`\n  平台管理员 ID: ${platformAdmin.id}`);
  console.log(`  时间: ${now.toISOString()}`);
}

main()
  .catch((error) => {
    console.error("❌ Seed 失败:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
