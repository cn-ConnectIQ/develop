import "dotenv/config";
import {
  ConnectionSource,
  ConnectionStatus,
  CrmSyncStatus,
  EventStatus,
  EventType,
  FeedItemType,
  IntentCategory,
  LeadStatus,
  ParticipantRole,
  PointsReason,
  PollStatus,
  PollType,
  RegistrationSource,
  RegistrationStatus,
  SnSessionStatus,
  UserAccountStatus,
  UserRole,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/client";

const SEED_PASSWORD = "ConnectIQ2024!";
const SEED_EMAIL_DOMAIN = "@connectiq.test";
const SEED_PHONES = [
  "13800000001",
  "13800000002",
  "13800000003",
  "13800000004",
  "13800000005",
  "13800000006",
];
const SEED_EVENT_SLUGS = [
  "saas-growth-summit-2025",
  "enterprise-digital-expo-2025",
  "product-salon-2025",
  // 兼容旧 seed
  "connectiq-summit-2026",
  "bagevent-expo-2026",
];
const SEED_ORG_SLUGS = ["connectiq-org", "digital-expo-org", "bagevent-org"];

const INTENT_TAGS: Array<{
  label: string;
  slug: string;
  category: IntentCategory;
  color: string;
}> = [
  { label: "ERP 系统", category: IntentCategory.TRADING, slug: "erp-system", color: "#185FA5" },
  { label: "CRM 软件", category: IntentCategory.TRADING, slug: "crm-software", color: "#185FA5" },
  { label: "营销自动化", category: IntentCategory.TRADING, slug: "marketing-automation", color: "#185FA5" },
  { label: "渠道代理商", category: IntentCategory.TRADING, slug: "channel-agent", color: "#185FA5" },
  { label: "SaaS 采购", category: IntentCategory.TRADING, slug: "saas-procurement", color: "#185FA5" },
  { label: "天使投资", category: IntentCategory.INVESTING, slug: "angel-investing", color: "#EF9F27" },
  { label: "VC 基金", category: IntentCategory.INVESTING, slug: "vc-fund", color: "#EF9F27" },
  { label: "战略投资", category: IntentCategory.INVESTING, slug: "strategic-investing", color: "#EF9F27" },
  { label: "产业基金", category: IntentCategory.INVESTING, slug: "industry-fund", color: "#EF9F27" },
  { label: "渠道合作伙伴", category: IntentCategory.PARTNERING, slug: "channel-partner", color: "#534AB7" },
  { label: "技术集成商", category: IntentCategory.PARTNERING, slug: "tech-integrator", color: "#534AB7" },
  { label: "解决方案集成", category: IntentCategory.PARTNERING, slug: "solution-integration", color: "#534AB7" },
  { label: "生态联盟", category: IntentCategory.PARTNERING, slug: "ecosystem-alliance", color: "#534AB7" },
  { label: "销售总监", category: IntentCategory.RECRUITING, slug: "sales-director", color: "#0F6E56" },
  { label: "产品经理", category: IntentCategory.RECRUITING, slug: "product-manager", color: "#0F6E56" },
  { label: "市场负责人", category: IntentCategory.RECRUITING, slug: "marketing-lead", color: "#0F6E56" },
  { label: "CTO", category: IntentCategory.RECRUITING, slug: "cto", color: "#0F6E56" },
  { label: "B2B 营销", category: IntentCategory.NETWORKING, slug: "b2b-marketing", color: "#854F0B" },
  { label: "SaaS 从业者", category: IntentCategory.NETWORKING, slug: "saas-practitioner", color: "#854F0B" },
  { label: "产品创业", category: IntentCategory.NETWORKING, slug: "product-startup", color: "#854F0B" },
];

const ATTENDEE_PROFILES = [
  { name: "张伟", company: "未来科技", jobTitle: "CEO", email: "zhangwei@example.com", phone: "13900000001" },
  { name: "李娜", company: "云端互动", jobTitle: "销售总监", email: "lina@example.com", phone: "13900000002" },
  { name: "王强", company: "智联会展", jobTitle: "市场负责人", email: "wangqiang@example.com", phone: "13900000003" },
  { name: "陈静", company: "数字营销实验室", jobTitle: "产品经理", email: "chenjing@example.com", phone: "13900000004" },
  { name: "刘洋", company: "创新工场", jobTitle: "投资经理", email: "liuyang@example.com", phone: "13900000005" },
  { name: "赵敏", company: "星河 SaaS", jobTitle: "运营总监", email: "zhaomin@example.com", phone: "13900000006" },
  { name: "孙磊", company: "极客营销", jobTitle: "增长负责人", email: "sunlei@example.com", phone: "13900000007" },
  { name: "周婷", company: "企服优选", jobTitle: "采购经理", email: "zhouting@example.com", phone: "13900000008" },
  { name: "吴昊", company: "数据驱动科技", jobTitle: "技术总监", email: "wuhao@example.com", phone: "13900000009" },
  { name: "郑琳", company: "品牌加速器", jobTitle: "品牌总监", email: "zhenglin@example.com", phone: "13900000010" },
];

const SPEAKER_PROFILES = [
  { name: "林峰", company: "增长研究院", jobTitle: "首席分析师", email: "linfeng@example.com", phone: "13900000011" },
  { name: "黄薇", company: "SaaS 洞察", jobTitle: "创始人", email: "huangwei@example.com", phone: "13900000012" },
];

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

function daysAgo(days: number, hours = 10) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

function badgeQr(participantId: string) {
  return `EVT001-${participantId.slice(0, 8).toUpperCase()}`;
}

async function createUser(params: {
  email: string;
  name: string;
  phone: string;
  passwordHash: string;
  roles: Array<{ role: UserRole; entityId?: string }>;
}) {
  const user = await prisma.user.create({
    data: {
      email: params.email,
      passwordHash: params.passwordHash,
      name: params.name,
      phone: params.phone,
      roleAssignments: {
        create: params.roles.map((r) => ({
          role: r.role,
          entityId: r.entityId ?? null,
        })),
      },
    },
  });
  return user;
}

async function seedAiOpsData(ctx: {
  conferenceEventId: string;
  platformAdminId: string;
  organizerId: string;
}) {
  await prisma.aiMatchResult.createMany({
    data: [
      {
        eventId: ctx.conferenceEventId,
        userAName: "张伟",
        userACompany: "未来科技",
        userBName: "李娜",
        userBCompany: "云端互动",
        score: 92,
        reason: "同行业 B2B SaaS，采购意向匹配",
        scenario: "PARTICIPANT_PEER",
        action: "CONTACTED",
        connected: true,
        createdAt: daysAgo(12),
      },
      {
        eventId: ctx.conferenceEventId,
        userAName: "王强",
        userACompany: "智联会展",
        userBName: "陈静",
        userBCompany: "数字营销实验室",
        score: 85,
        reason: "活动运营场景互补",
        scenario: "EXHIBITOR_TO_BUYER",
        action: "VIEWED",
        connected: false,
        createdAt: daysAgo(10),
      },
      {
        eventId: ctx.conferenceEventId,
        userAName: "刘洋",
        userACompany: "创新工场",
        userBName: "赵敏",
        userBCompany: "星河 SaaS",
        score: 78,
        reason: "投资与渠道资源匹配",
        scenario: "BUYER_TO_EXHIBITOR",
        action: "IGNORED",
        connected: false,
        createdAt: daysAgo(8),
      },
    ],
  });

  await prisma.aiGenerationLog.createMany({
    data: [
      {
        type: "CONNECTION_NOTE",
        promptVersion: "v2.3",
        tokensUsed: 420,
        adopted: true,
        edited: false,
        contentPreview: "很高兴在 SaaS 增长峰会认识您...",
        createdAt: daysAgo(5),
      },
      {
        type: "FOLLOWUP_EMAIL",
        promptVersion: "v2.2",
        tokensUsed: 680,
        adopted: true,
        edited: true,
        contentPreview: "感谢昨日交流，附件是我们最新的产品白皮书...",
        qualityRating: "PASS",
        createdAt: daysAgo(3),
      },
    ],
  });

  await prisma.aiPromptVersion.createMany({
    data: [
      {
        version: "v2.3",
        type: "CONNECTION_NOTE",
        adoption: 76,
        editRate: 18,
        avgTokens: 420,
        status: "ACTIVE",
      },
      {
        version: "v2.2",
        type: "FOLLOWUP_EMAIL",
        adoption: 68,
        editRate: 24,
        avgTokens: 680,
        status: "ACTIVE",
      },
    ],
  });

  const period = "2026-06";
  await prisma.monthlyInsight.createMany({
    data: [
      {
        userId: ctx.organizerId,
        period,
        content: "本月签到率 62%，SN 配对连接转化率提升 15%。",
        actions: ["优化 VIP 签到流程", "增加 SN 配对场次"],
        viewed: true,
        status: "GENERATED",
        generatedAt: daysAgo(2),
      },
      {
        userId: ctx.platformAdminId,
        period,
        content: "平台整体连接转化率提升 12%。",
        actions: ["扩大 A/B 测试范围"],
        viewed: false,
        status: "GENERATED",
        generatedAt: daysAgo(1),
      },
    ],
  });

  await prisma.aiFeedback.createMany({
    data: [
      { type: "MATCH_USEFUL", positive: true, userId: ctx.organizerId, createdAt: daysAgo(6) },
      { type: "MATCH_USELESS", positive: false, negativeReason: "行业不对口", createdAt: daysAgo(5) },
      { type: "TIMING_ACCURATE", positive: true, createdAt: daysAgo(4) },
      { type: "CONTENT_QUALITY", positive: true, createdAt: daysAgo(3) },
    ],
  });
}

async function seedPlatformData(ctx: {
  conferenceEventId: string;
  conferenceEventName: string;
  platformAdminId: string;
  organizerId: string;
  exhibitor1Id: string;
  exhibitor2Id: string;
  connections: Array<{ userAName: string; userACompany: string; userBName: string; userBCompany: string }>;
}) {
  await prisma.userProfile.createMany({
    data: [
      {
        userId: ctx.platformAdminId,
        company: "ConnectIQ",
        industry: "活动科技",
        valueProposition: "连接活动主办方与参会者",
        intentTags: ["平台运营", "数据分析"],
        accountStatus: UserAccountStatus.COMPLETE,
        registrationSource: RegistrationSource.PHONE,
        pointsBalance: 1200,
      },
      {
        userId: ctx.organizerId,
        company: "智联会展",
        industry: "会展服务",
        valueProposition: "一站式活动运营",
        intentTags: ["B2B", "活动主办"],
        accountStatus: UserAccountStatus.ACTIVE,
        registrationSource: RegistrationSource.PHONE,
        pointsBalance: 860,
      },
      {
        userId: ctx.exhibitor1Id,
        company: "云智 ERP",
        industry: "企业软件",
        valueProposition: "中小企业 ERP 解决方案",
        intentTags: ["ERP", "渠道合作"],
        accountStatus: UserAccountStatus.COMPLETE,
        registrationSource: RegistrationSource.WECHAT,
        pointsBalance: 320,
      },
      {
        userId: ctx.exhibitor2Id,
        company: "数链 CRM",
        industry: "SaaS",
        valueProposition: "B2B 销售 CRM 平台",
        intentTags: ["CRM", "营销自动化"],
        accountStatus: UserAccountStatus.ACTIVE,
        registrationSource: RegistrationSource.EMAIL,
        pointsBalance: 180,
      },
    ],
  });

  const sources = [
    ConnectionSource.AI_RECOMMEND,
    ConnectionSource.SCAN,
    ConnectionSource.SPEED_NETWORKING,
    ConnectionSource.REFERRAL,
  ] as const;

  for (const [index, conn] of ctx.connections.entries()) {
    await prisma.businessConnection.create({
      data: {
        userAName: conn.userAName,
        userACompany: conn.userACompany,
        userBName: conn.userBName,
        userBCompany: conn.userBCompany,
        source: sources[index % sources.length],
        originContext: ["AI 撮合", "展位扫码", "SN 配对", "主动引荐"][index],
        eventId: ctx.conferenceEventId,
        eventName: ctx.conferenceEventName,
        depth: index + 2,
        aiScore: 88 - index * 5,
        status: ConnectionStatus.ACTIVE,
        createdAt: daysAgo(20 - index * 3),
        interactions: {
          create: [
            {
              type: "EVENT",
              description: "同场活动认识",
              occurredAt: daysAgo(18 - index * 3, 14),
            },
            ...(index % 2 === 0
              ? [
                  {
                    type: "MESSAGE",
                    description: "发送跟进消息",
                    occurredAt: daysAgo(17 - index * 3, 16),
                  },
                ]
              : []),
          ],
        },
      },
    });
  }

  const ledgerUsers = [
    ctx.organizerId,
    ctx.exhibitor1Id,
    ctx.exhibitor2Id,
    ctx.platformAdminId,
  ];
  const reasons = [
    PointsReason.CHECKIN,
    PointsReason.CONNECTION,
    PointsReason.INTERACTION,
    PointsReason.PROFILE,
    PointsReason.REFERRAL,
    PointsReason.ADJUSTMENT,
  ] as const;

  await prisma.pointsLedger.createMany({
    data: ledgerUsers.flatMap((userId, ui) =>
      reasons.slice(0, 3).map((reason, ri) => ({
        userId,
        amount: 20 + ui * 10 + ri * 5,
        reason,
        note: reason === PointsReason.ADJUSTMENT ? "测试补发" : undefined,
        createdAt: daysAgo(25 - ui * 4 - ri),
      })),
    ),
  });

  await prisma.pointsRedemption.createMany({
    data: [
      { userId: ctx.organizerId, benefitName: "VIP 议程解锁", pointsSpent: 200, createdAt: daysAgo(7) },
      { userId: ctx.platformAdminId, benefitName: "数据报告导出", pointsSpent: 150, createdAt: daysAgo(5) },
    ],
  });

  await prisma.feedItem.createMany({
    data: [
      {
        userId: ctx.organizerId,
        type: FeedItemType.MATCH,
        content: "AI 推荐您与「数链 CRM」建立连接",
        aiScore: 88,
        triggerReason: "采购意向匹配",
        createdAt: daysAgo(4),
      },
      {
        userId: ctx.exhibitor1Id,
        type: FeedItemType.REMINDER,
        content: "完善公司资料可提升匹配准确度",
        aiScore: 65,
        triggerReason: "资料完整度低于 60%",
        createdAt: daysAgo(2),
      },
    ],
  });
}

async function clearSeedData() {
  const seedUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: SEED_EMAIL_DOMAIN } },
        { phone: { in: SEED_PHONES } },
      ],
    },
    select: { id: true },
  });
  const seedUserIds = seedUsers.map((u) => u.id);

  await prisma.event.deleteMany({
    where: {
      OR: [
        { slug: { in: SEED_EVENT_SLUGS } },
        ...(seedUserIds.length > 0
          ? [{ organizerId: { in: seedUserIds } }]
          : []),
      ],
    },
  });

  await prisma.organization.deleteMany({
    where: { slug: { in: SEED_ORG_SLUGS } },
  });

  await prisma.intentTag.deleteMany({
    where: { slug: { in: INTENT_TAGS.map((t) => t.slug) } },
  });

  await prisma.user.deleteMany({
    where: { id: { in: seedUserIds } },
  });
}

async function main() {
  console.log("🌱 开始写入 ConnectIQ 开发测试数据...\n");

  await clearSeedData();
  const passwordHash = await hashPassword(SEED_PASSWORD);

  const connectiqOrg = await prisma.organization.create({
    data: { name: "ConnectIQ", slug: "connectiq-org" },
  });
  const expoOrg = await prisma.organization.create({
    data: { name: "数字化展览集团", slug: "digital-expo-org" },
  });

  // ── 1. 用户 ──────────────────────────────────────────────
  const platformAdmin = await createUser({
    email: `admin${SEED_EMAIL_DOMAIN}`,
    name: "平台管理员",
    phone: "13800000001",
    passwordHash,
    roles: [{ role: UserRole.PLATFORM_ADMIN }],
  });

  const organizer1 = await createUser({
    email: `organizer1${SEED_EMAIL_DOMAIN}`,
    name: "主办方 · 陈明",
    phone: "13800000002",
    passwordHash,
    roles: [],
  });

  const organizer2 = await createUser({
    email: `organizer2${SEED_EMAIL_DOMAIN}`,
    name: "主办方 · 杨帆",
    phone: "13800000003",
    passwordHash,
    roles: [],
  });

  const expoOrganizer = await createUser({
    email: `expo${SEED_EMAIL_DOMAIN}`,
    name: "展览主办方 · 刘佳",
    phone: "13800000004",
    passwordHash,
    roles: [],
  });

  const exhibitor1 = await createUser({
    email: `exhibitor1${SEED_EMAIL_DOMAIN}`,
    name: "展商 · 云智 ERP",
    phone: "13800000005",
    passwordHash,
    roles: [],
  });

  const exhibitor2 = await createUser({
    email: `exhibitor2${SEED_EMAIL_DOMAIN}`,
    name: "展商 · 数链 CRM",
    phone: "13800000006",
    passwordHash,
    roles: [],
  });

  // ── 3. 活动 ──────────────────────────────────────────────
  const now = new Date();
  const conferenceEvent = await prisma.event.create({
    data: {
      name: "SaaS 增长峰会 2025",
      slug: "saas-growth-summit-2025",
      type: EventType.CONFERENCE,
      status: EventStatus.LIVE,
      description: "聚焦 B2B SaaS 增长策略的行业峰会（开发测试 · LIVE）",
      location: "上海 · 张江科学会堂",
      startDate: daysAgo(1),
      endDate: new Date(now.getTime() + 2 * 86_400_000),
      organizerId: organizer1.id,
      organizationId: connectiqOrg.id,
      createdAt: daysAgo(28),
      settings: {
        create: [
          { key: "category", value: "SUMMIT" },
          { key: "registration_open", value: true },
        ],
      },
    },
  });

  const expoEvent = await prisma.event.create({
    data: {
      name: "2025 企业数字化展览会",
      slug: "enterprise-digital-expo-2025",
      type: EventType.EXPO,
      status: EventStatus.PUBLISHED,
      description: "企业数字化解决方案展览（开发测试 · PUBLISHED）",
      location: "深圳 · 会展中心",
      startDate: daysAgo(-14),
      endDate: daysAgo(-12),
      organizerId: expoOrganizer.id,
      organizationId: expoOrg.id,
      createdAt: daysAgo(25),
      settings: { create: { key: "category", value: "EXPO" } },
    },
  });

  const salonEvent = await prisma.event.create({
    data: {
      name: "产品创业沙龙",
      slug: "product-salon-2025",
      type: EventType.CONFERENCE,
      status: EventStatus.DRAFT,
      description: "小型闭门产品创业交流沙龙（开发测试 · DRAFT / SALON）",
      location: "北京 · 798 艺术区",
      organizerId: organizer2.id,
      organizationId: connectiqOrg.id,
      createdAt: daysAgo(20),
      settings: { create: { key: "category", value: "SALON" } },
    },
  });

  await prisma.userRoleAssignment.createMany({
    data: [
      { userId: organizer1.id, role: UserRole.ORGANIZER, entityId: conferenceEvent.id },
      // 开发环境：主办方账号也可切换平台管理员，便于访问 /platform/overview
      { userId: organizer1.id, role: UserRole.PLATFORM_ADMIN },
      { userId: organizer2.id, role: UserRole.ORGANIZER, entityId: salonEvent.id },
      { userId: expoOrganizer.id, role: UserRole.EXPO_ORGANIZER, entityId: expoEvent.id },
      {
        userId: platformAdmin.id,
        role: UserRole.ORGANIZER,
        entityId: conferenceEvent.id,
      },
      {
        userId: platformAdmin.id,
        role: UserRole.EXPO_ORGANIZER,
        entityId: expoEvent.id,
      },
    ],
  });

  // ── 2. 意图标签（20 个，覆盖全部 IntentCategory）──────────
  await prisma.intentTag.createMany({
    data: INTENT_TAGS.map((tag, index) => ({
      ...tag,
      eventId: expoEvent.id,
      sortOrder: index + 1,
      createdAt: daysAgo(22 - index % 5),
    })),
  });

  const intentTagBySlug = Object.fromEntries(
    (
      await prisma.intentTag.findMany({
        where: { eventId: expoEvent.id },
        select: { id: true, slug: true },
      })
    ).map((t) => [t.slug, t.id]),
  );

  // ── 4. 参会者（CONFERENCE）────────────────────────────────
  const vipTicket = await prisma.ticketType.create({
    data: {
      eventId: conferenceEvent.id,
      name: "VIP 通票",
      price: 1999,
      quota: 50,
      createdAt: daysAgo(26),
    },
  });

  const standardTicket = await prisma.ticketType.create({
    data: {
      eventId: conferenceEvent.id,
      name: "标准票",
      price: 599,
      quota: 500,
      createdAt: daysAgo(26),
    },
  });

  const speakerTicket = await prisma.ticketType.create({
    data: {
      eventId: conferenceEvent.id,
      name: "嘉宾票",
      price: 0,
      quota: 20,
      createdAt: daysAgo(26),
    },
  });

  const conferenceParticipants: Array<{ id: string; name: string; company: string | null }> = [];

  for (const [index, profile] of ATTENDEE_PROFILES.slice(0, 8).entries()) {
    const created = await prisma.participant.create({
      data: {
        eventId: conferenceEvent.id,
        ...profile,
        role: ParticipantRole.ATTENDEE,
        createdAt: daysAgo(24 - index),
      },
    });
    await prisma.participant.update({
      where: { id: created.id },
      data: { badgeQr: badgeQr(created.id) },
    });
    const isVip = index === 0;
    const ticketType = isVip ? vipTicket : standardTicket;
    await prisma.participantRegistration.create({
      data: {
        participantId: created.id,
        ticketTypeId: ticketType.id,
        status: RegistrationStatus.CONFIRMED,
        registeredAt: daysAgo(20 - index),
      },
    });
    if (index < 5) {
      await prisma.checkIn.create({
        data: {
          eventId: conferenceEvent.id,
          participantId: created.id,
          method: index < 3 ? "qr" : "manual",
          checkedInAt: daysAgo(1, 9 + index),
        },
      });
    }
    conferenceParticipants.push(created);
  }

  for (const [index, profile] of SPEAKER_PROFILES.entries()) {
    const created = await prisma.participant.create({
      data: {
        eventId: conferenceEvent.id,
        ...profile,
        role: ParticipantRole.SPEAKER,
        createdAt: daysAgo(18 - index),
      },
    });
    await prisma.participant.update({
      where: { id: created.id },
      data: { badgeQr: badgeQr(created.id) },
    });
    await prisma.participantRegistration.create({
      data: {
        participantId: created.id,
        ticketTypeId: speakerTicket.id,
        status: RegistrationStatus.CONFIRMED,
        registeredAt: daysAgo(15 - index),
      },
    });
    await prisma.checkIn.create({
      data: {
        eventId: conferenceEvent.id,
        participantId: created.id,
        method: "manual",
        checkedInAt: daysAgo(1, 8 + index),
      },
    });
    conferenceParticipants.push(created);
  }

  // ── 5. 展商（EXPO）────────────────────────────────────────
  const hallA = await prisma.expoHall.create({
    data: { eventId: expoEvent.id, name: "A 馆", floor: "1F" },
  });
  const hallB = await prisma.expoHall.create({
    data: { eventId: expoEvent.id, name: "B 馆", floor: "2F" },
  });

  const boothA01 = await prisma.booth.create({
    data: {
      name: "云智 ERP 展位",
      code: "A-01",
      eventId: expoEvent.id,
      hallId: hallA.id,
      exhibitorId: exhibitor1.id,
      status: "OCCUPIED",
      positionData: { x: 10, y: 12, width: 8, height: 6 },
      createdAt: daysAgo(20),
      leadFormConfig: {
        fields: [
          {
            id: "intent",
            label: "采购意向",
            type: "select",
            required: true,
            options: ["2A", "2B", "1C"],
            sortOrder: 0,
          },
        ],
      },
    },
  });

  const boothB03 = await prisma.booth.create({
    data: {
      name: "数链 CRM 展位",
      code: "B-03",
      eventId: expoEvent.id,
      hallId: hallB.id,
      exhibitorId: exhibitor2.id,
      status: "OCCUPIED",
      positionData: { x: 22, y: 8, width: 8, height: 6 },
      createdAt: daysAgo(19),
    },
  });

  await prisma.userRoleAssignment.createMany({
    data: [
      { userId: exhibitor1.id, role: UserRole.EXHIBITOR, entityId: boothA01.id },
      { userId: exhibitor2.id, role: UserRole.EXHIBITOR, entityId: boothB03.id },
      { userId: platformAdmin.id, role: UserRole.EXHIBITOR, entityId: boothA01.id },
    ],
  });

  await prisma.boothBooking.createMany({
    data: [
      { boothId: boothA01.id, status: RegistrationStatus.CONFIRMED, bookedAt: daysAgo(18) },
      { boothId: boothB03.id, status: RegistrationStatus.CONFIRMED, bookedAt: daysAgo(17) },
    ],
  });

  const expoVisitors = await Promise.all(
    ATTENDEE_PROFILES.slice(0, 5).map((profile, index) =>
      prisma.participant.create({
        data: {
          eventId: expoEvent.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          company: profile.company,
          jobTitle: profile.jobTitle,
          createdAt: daysAgo(10 - index),
        },
      }),
    ),
  );

  const leadSpecs = [
    { boothId: boothA01.id, participant: expoVisitors[0], grade: "2A", status: LeadStatus.QUALIFIED, crm: CrmSyncStatus.SYNCED },
    { boothId: boothA01.id, participant: expoVisitors[1], grade: "2A", status: LeadStatus.CONTACTED, crm: CrmSyncStatus.PENDING },
    { boothId: boothB03.id, participant: expoVisitors[2], grade: "2B", status: LeadStatus.NEW, crm: CrmSyncStatus.SYNCED },
    { boothId: boothB03.id, participant: expoVisitors[3], grade: "2B", status: LeadStatus.QUALIFIED, crm: CrmSyncStatus.FAILED },
    { boothId: boothA01.id, participant: expoVisitors[4], grade: "1C", status: LeadStatus.NEW, crm: CrmSyncStatus.PENDING },
  ] as const;

  for (const [index, spec] of leadSpecs.entries()) {
    const lead = await prisma.lead.create({
      data: {
        boothId: spec.boothId,
        participantId: spec.participant.id,
        intentGrade: spec.grade,
        status: spec.status,
        crmSyncStatus: spec.crm,
        crmSyncedAt: spec.crm === CrmSyncStatus.SYNCED ? daysAgo(3 - index) : null,
        crmSyncError: spec.crm === CrmSyncStatus.FAILED ? "MarketUP API 超时" : null,
        notes: `意向等级 ${spec.grade} · 展会现场扫码`,
        createdAt: daysAgo(8 - index),
      },
    });
    const tagSlug =
      index % 2 === 0 ? "erp-system" : "crm-software";
    const tagId = intentTagBySlug[tagSlug];
    if (tagId) {
      await prisma.leadIntentTag.create({
        data: { leadId: lead.id, intentTagId: tagId },
      });
    }
  }

  // ── 7. 投票 ───────────────────────────────────────────────
  const livePoll = await prisma.poll.create({
    data: {
      eventId: conferenceEvent.id,
      createdById: organizer1.id,
      type: PollType.SINGLE_CHOICE,
      title: "您认为 AI 对 B2B 销售最大的影响是什么？",
      status: PollStatus.LIVE,
      showResults: true,
      closesAt: new Date(now.getTime() + 60 * 60_000),
      createdAt: daysAgo(2),
      options: {
        create: [
          { text: "提升线索转化效率", displayOrder: 0 },
          { text: "改变客户沟通方式", displayOrder: 1 },
          { text: "优化销售预测", displayOrder: 2 },
          { text: "降低获客成本", displayOrder: 3 },
        ],
      },
    },
    include: { options: true },
  });

  const closedPoll = await prisma.poll.create({
    data: {
      eventId: conferenceEvent.id,
      createdById: organizer1.id,
      type: PollType.SINGLE_CHOICE,
      title: "您对开幕主题演讲的整体评价？",
      status: PollStatus.CLOSED,
      createdAt: daysAgo(5),
      options: {
        create: [
          { text: "非常满意", displayOrder: 0 },
          { text: "满意", displayOrder: 1 },
          { text: "一般", displayOrder: 2 },
          { text: "待改进", displayOrder: 3 },
        ],
      },
    },
    include: { options: true },
  });

  for (const [index, participant] of conferenceParticipants.slice(0, 8).entries()) {
    const option = livePoll.options[index % livePoll.options.length];
    if (option) {
      await prisma.pollResponse.create({
        data: {
          pollId: livePoll.id,
          participantId: participant.id,
          optionId: option.id,
          createdAt: daysAgo(1, 15 - index),
        },
      });
    }
  }

  for (const [index, participant] of conferenceParticipants.slice(0, 6).entries()) {
    const option = closedPoll.options[index % 3];
    if (option) {
      await prisma.pollResponse.create({
        data: {
          pollId: closedPoll.id,
          participantId: participant.id,
          optionId: option.id,
          rating: index < 4 ? 5 : 4,
          createdAt: daysAgo(3, 12 - index),
        },
      });
    }
  }

  // ── 8. Speed Networking ───────────────────────────────────
  const snSession = await prisma.snSession.create({
    data: {
      eventId: conferenceEvent.id,
      status: SnSessionStatus.COMPLETED,
      roundCount: 2,
      startedAt: daysAgo(1, 14),
      endedAt: daysAgo(1, 16),
      createdAt: daysAgo(7),
    },
  });

  const snParticipants = conferenceParticipants.slice(0, 6);
  const snPairSpecs = [
    { a: 0, b: 1, round: 1, ratingA: 5, ratingB: 4, connected: true },
    { a: 2, b: 3, round: 1, ratingA: 4, ratingB: 5, connected: true },
    { a: 4, b: 5, round: 2, ratingA: 3, ratingB: 4, connected: false },
    { a: 0, b: 4, round: 2, ratingA: 5, ratingB: 5, connected: false },
  ] as const;

  await prisma.snPair.createMany({
    data: snPairSpecs.map((spec) => ({
      sessionId: snSession.id,
      participantAId: snParticipants[spec.a]!.id,
      participantBId: snParticipants[spec.b]!.id,
      round: spec.round,
      ratingA: spec.ratingA,
      ratingB: spec.ratingB,
      connectionEstablished: spec.connected,
      createdAt: daysAgo(1, 15 - spec.round),
    })),
  });

  // ── 6 & 9. 连接 + 平台数据 ────────────────────────────────
  const connectionProfiles = [
    { userAName: "张伟", userACompany: "未来科技", userBName: "李娜", userBCompany: "云端互动" },
    { userAName: "王强", userACompany: "智联会展", userBName: "陈静", userBCompany: "数字营销实验室" },
    { userAName: "刘洋", userACompany: "创新工场", userBName: "赵敏", userBCompany: "星河 SaaS" },
    { userAName: "林峰", userACompany: "增长研究院", userBName: "黄薇", userBCompany: "SaaS 洞察" },
  ];

  await seedPlatformData({
    conferenceEventId: conferenceEvent.id,
    conferenceEventName: conferenceEvent.name,
    platformAdminId: platformAdmin.id,
    organizerId: organizer1.id,
    exhibitor1Id: exhibitor1.id,
    exhibitor2Id: exhibitor2.id,
    connections: connectionProfiles,
  });

  await seedAiOpsData({
    conferenceEventId: conferenceEvent.id,
    platformAdminId: platformAdmin.id,
    organizerId: organizer1.id,
  });

  const checkedInCount = await prisma.checkIn.count({
    where: { eventId: conferenceEvent.id },
  });

  console.log("✅ Seed 完成\n");
  console.log("── 测试账号（密码: ConnectIQ2024!）──");
  console.log(`平台管理员: admin${SEED_EMAIL_DOMAIN}  手机 13800000001`);
  console.log(`主办方 1:   organizer1${SEED_EMAIL_DOMAIN}  手机 13800000002`);
  console.log(`主办方 2:   organizer2${SEED_EMAIL_DOMAIN}  手机 13800000003`);
  console.log(`展览主办方: expo${SEED_EMAIL_DOMAIN}  手机 13800000004`);
  console.log(`参展商 1:   exhibitor1${SEED_EMAIL_DOMAIN}  手机 13800000005`);
  console.log(`参展商 2:   exhibitor2${SEED_EMAIL_DOMAIN}  手机 13800000006`);
  console.log("\n── 活动 ──");
  console.log(`CONFERENCE (LIVE):  ${conferenceEvent.name}  ${conferenceEvent.id}`);
  console.log(`EXPO (PUBLISHED):   ${expoEvent.name}  ${expoEvent.id}`);
  console.log(`SALON (DRAFT):      ${salonEvent.name}  ${salonEvent.id}`);
  console.log("\n── 数据统计 ──");
  console.log(`参会者:     ${conferenceParticipants.length} 人（8 普通 + 2 嘉宾，含 1 VIP）`);
  console.log(`已签到:     ${checkedInCount} 人`);
  console.log(`意向标签:   ${INTENT_TAGS.length} 个`);
  console.log(`展位:       A-01 / B-03`);
  console.log(`线索:       5 条（2A×2, 2B×2, 1C×1）`);
  console.log(`商业连接:   4 条 ACTIVE`);
  console.log(`SN 配对:    1 场次 COMPLETED，4 对（2 对建立连接）`);
  console.log(`投票 LIVE:  ${livePoll.id}`);
  console.log(`投票 CLOSED:${closedPoll.id}`);
}

main()
  .catch((error) => {
    console.error("❌ Seed 失败:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
