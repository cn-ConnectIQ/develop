/**
 * 展会场景 Mock 数据：50 展位 + 100 采购商（买家）
 *
 * 用法：
 *   pnpm --filter @connectiq/database db:seed:expo-mock
 *   pnpm --filter @connectiq/database db:seed:expo-mock -- --clean   # 仅清除 mock 数据
 *
 * 目标活动：enterprise-digital-expo-2025（需先运行 db:seed）
 */
import "dotenv/config";
import {
  AccountType,
  AdminStatus,
  ApplicationStatus,
  BoothStatus,
  CrmSyncStatus,
  InviteStatus,
  LeadStatus,
  MemberTier,
  OrgJoinSource,
  OrgStaffRole,
  ParticipantInviteStatus,
  RegistrationStatus,
  StampRallyStatus,
  TicketStatus,
  UserAccountStatus,
  UserRole,
  UserType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/client";

const EVENT_SLUG = "enterprise-digital-expo-2025";
const BOOTH_COUNT = 50;
const BUYER_COUNT = 100;
const SEED_PASSWORD = "ConnectIQ2024!";
const MOCK_ORG_SLUG_PREFIX = "mock-exhibitor-";
const MOCK_BOOTH_ID_PREFIX = "seed-mock-booth-";
const MOCK_BUYER_ID_PREFIX = "seed-mock-buyer-";

const EXHIBITOR_INDUSTRIES = [
  "企业 SaaS",
  "云计算",
  "网络安全",
  "大数据",
  "人工智能",
  "智能制造",
  "金融科技",
  "供应链",
  "数字营销",
  "人力资源科技",
  "物联网",
  "低代码平台",
  "ERP/CRM",
  "电商科技",
  "医疗信息化",
];

const COMPANY_PREFIXES = [
  "云智",
  "数联",
  "慧通",
  "星链",
  "深蓝",
  "极光",
  "睿达",
  "创界",
  "华信",
  "博远",
  "鼎新",
  "启明",
  "天工",
  "金石",
  "纵横",
];

const COMPANY_SUFFIXES = [
  "科技",
  "软件",
  "信息",
  "数字",
  "智能",
  "云服",
  "数据",
  "系统",
  "网络",
  "解决方案",
];

const HQ_CITIES = [
  "北京市 · 海淀区",
  "上海市 · 浦东新区",
  "深圳市 · 南山区",
  "杭州市 · 余杭区",
  "广州市 · 天河区",
  "成都市 · 高新区",
  "南京市 · 建邺区",
  "苏州市 · 工业园区",
  "武汉市 · 东湖高新区",
  "西安市 · 高新区",
];

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

const BUYER_SURNAMES = [
  "王", "李", "张", "刘", "陈", "杨", "赵", "黄", "周", "吴",
  "徐", "孙", "胡", "朱", "高", "林", "何", "郭", "马", "罗",
];

const BUYER_GIVEN = [
  "伟", "芳", "娜", "敏", "静", "丽", "强", "磊", "军", "洋",
  "勇", "艳", "杰", "涛", "明", "超", "秀英", "华", "慧", "鹏",
];

const BUYER_COMPANIES = [
  "华润集团", "万科企业", "比亚迪股份", "宁德时代", "海尔智家",
  "美的集团", "格力电器", "中兴通讯", "TCL科技", "京东方",
  "顺丰控股", "京东物流", "菜鸟网络", "拼多多", "字节跳动",
  "美团", "滴滴出行", "网易", "携程集团", "贝壳找房",
  "理想汽车", "蔚来汽车", "小鹏汽车", "三一重工", "中联重科",
  "徐工机械", "中国中车", "中航工业", "中国建材", "紫金矿业",
  "恒瑞医药", "迈瑞医疗", "药明康德", "爱尔眼科", "通策医疗",
  "招商银行", "平安银行", "中信证券", "华泰证券", "中国人寿",
  "中国平安", "中国人保", "蚂蚁集团", "微众银行", "陆金所",
  "中芯国际", "华虹半导体", "长电科技", "北方华创", "韦尔股份",
];

const BUYER_TITLES = [
  "采购总监",
  "采购经理",
  "VP 采购",
  "供应链总监",
  "CIO",
  "CTO",
  "IT 总监",
  "数字化负责人",
  "运营总监",
  "市场总监",
  "产品总监",
  "技术总监",
  "信息化经理",
  "战略采购经理",
  "品类经理",
];

const MEMBER_TAGS = [
  "高意向",
  "预算充足",
  "决策人",
  "技术评估",
  "Q1采购",
  "老客户",
  "渠道伙伴",
  "重点跟进",
  "华东区",
  "华南区",
];

const LEAD_NOTES = [
  "对 CRM 集成方案感兴趣，希望安排产品演示",
  "正在评估替换现有 ERP，预算 200 万以内",
  "需要支持私有化部署，关注数据安全合规",
  "希望了解与现有 OA 系统的对接能力",
  "计划 Q2 立项，需 ROI 测算报告",
  "已有竞品在用，处于对比选型阶段",
  "现场沟通积极，索要了详细报价单",
  "关注售后服务与本地化实施团队",
  "需要多部门试用账号",
  "希望安排总部技术团队二次拜访",
];

function phoneToEmail(phone: string) {
  return `${phone}@phone.connectiq.local`;
}

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length]!;
}

function hashIndex(seed: number, mod: number) {
  return ((seed * 9301 + 49297) % 233280) % mod;
}

function daysAgo(days: number, hours = 10) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

function boothCode(index: number): { hall: string; code: string; floor: string } {
  const halls = [
    { hall: "A 馆", floor: "1F", perHall: 17 },
    { hall: "B 馆", floor: "2F", perHall: 17 },
    { hall: "C 馆", floor: "3F", perHall: 16 },
  ];
  let remaining = index;
  for (const h of halls) {
    if (remaining < h.perHall) {
      const letter = h.hall.charAt(0);
      return {
        hall: h.hall,
        code: `${letter}-${String(remaining + 1).padStart(2, "0")}`,
        floor: h.floor,
      };
    }
    remaining -= h.perHall;
  }
  return { hall: "C 馆", code: `C-${String(index + 1).padStart(2, "0")}`, floor: "3F" };
}

function boothPosition(index: number) {
  const col = index % 10;
  const row = Math.floor(index / 10);
  const width = 4 + (index % 3);
  const height = 4 + ((index + 1) % 3);
  return {
    x: 4 + col * 9,
    y: 4 + row * 8,
    width,
    height,
  };
}

function exhibitorCompanyName(index: number) {
  const prefix = pick(COMPANY_PREFIXES, index + 3);
  const suffix = pick(COMPANY_SUFFIXES, index * 7 + 1);
  const industry = pick(EXHIBITOR_INDUSTRIES, index);
  return `${prefix}${suffix}（${industry.slice(0, 4)}）`;
}

function buyerName(index: number) {
  const surname = pick(BUYER_SURNAMES, index);
  const given = pick(BUYER_GIVEN, index * 3 + 1);
  return `${surname}${given}`;
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

async function cleanMockData() {
  const mockBuyerIds = Array.from({ length: BUYER_COUNT }, (_, i) =>
    `${MOCK_BUYER_ID_PREFIX}${String(i + 1).padStart(3, "0")}`,
  );
  const mockBoothIds = Array.from({ length: BOOTH_COUNT }, (_, i) =>
    `${MOCK_BOOTH_ID_PREFIX}${String(i + 1).padStart(3, "0")}`,
  );
  const mockOrgSlugs = Array.from({ length: BOOTH_COUNT }, (_, i) =>
    `${MOCK_ORG_SLUG_PREFIX}${String(i + 1).padStart(3, "0")}`,
  );
  const exhibitorPhones = Array.from({ length: BOOTH_COUNT }, (_, i) =>
    `137100${String(i + 1).padStart(5, "0")}`,
  );
  const buyerPhones = Array.from({ length: BUYER_COUNT }, (_, i) =>
    `136200${String(i + 1).padStart(5, "0")}`,
  );

  await prisma.lead.deleteMany({
    where: {
      OR: [
        { participantId: { in: mockBuyerIds } },
        { boothId: { in: mockBoothIds } },
      ],
    },
  });
  await prisma.checkIn.deleteMany({
    where: { participantId: { in: mockBuyerIds } },
  });
  await prisma.ticket.deleteMany({
    where: { participantId: { in: mockBuyerIds } },
  });
  await prisma.participantRegistration.deleteMany({
    where: { participantId: { in: mockBuyerIds } },
  });
  await prisma.participant.deleteMany({
    where: { id: { in: mockBuyerIds } },
  });
  await prisma.exhibitorBooth.deleteMany({
    where: { id: { in: mockBoothIds } },
  });

  const mockUsers = await prisma.user.findMany({
    where: {
      phone: { in: [...exhibitorPhones, ...buyerPhones] },
    },
    select: { id: true },
  });
  const mockUserIds = mockUsers.map((u) => u.id);

  if (mockUserIds.length > 0) {
    await prisma.orgMember.deleteMany({ where: { userId: { in: mockUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: mockUserIds } } });
  }

  await prisma.organization.deleteMany({
    where: { slug: { in: mockOrgSlugs } },
  });

  console.log("✓ 已清除展会 mock 数据");
}

async function seedExhibitorBooths(
  eventId: string,
  expoOrgId: string,
  halls: Map<string, string>,
) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const statuses: BoothStatus[] = [
    BoothStatus.OCCUPIED,
    BoothStatus.OCCUPIED,
    BoothStatus.BOOKED,
    BoothStatus.BOOKED,
    BoothStatus.AVAILABLE,
  ];

  for (let i = 0; i < BOOTH_COUNT; i++) {
    const n = i + 1;
    const id = `${MOCK_BOOTH_ID_PREFIX}${String(n).padStart(3, "0")}`;
    const slug = `${MOCK_ORG_SLUG_PREFIX}${String(n).padStart(3, "0")}`;
    const phone = `137100${String(n).padStart(5, "0")}`;
    const { hall, code, floor } = boothCode(i);
    const pos = boothPosition(i);
    const industry = pick(EXHIBITOR_INDUSTRIES, i);
    const companyName = exhibitorCompanyName(i);

    const operator = await prisma.user.upsert({
      where: { email: phoneToEmail(phone) },
      update: {
        phone,
        name: `${companyName.slice(0, 6)}·销售负责人`,
        userType: UserType.ACCOUNT_ADMIN,
        passwordHash,
      },
      create: {
        email: phoneToEmail(phone),
        phone,
        name: `${companyName.slice(0, 6)}·销售负责人`,
        passwordHash,
        userType: UserType.ACCOUNT_ADMIN,
      },
    });

    const org = await prisma.organization.upsert({
      where: { slug },
      update: {
        name: companyName,
        accountType: AccountType.EXHIBITOR,
        industry,
        companySize: pick(COMPANY_SIZES, i),
        headquarters: pick(HQ_CITIES, i),
        foundedYear: 2005 + (i % 18),
        website: `https://www.${slug.replace(/-/g, "")}.com`,
        contactEmail: `sales@${slug.replace(/-/g, "")}.com`,
        bio: `${companyName} 专注 ${industry} 领域，为中型及大型企业提供数字化解决方案，本次携核心产品亮相展会。`,
        isVerified: i % 5 !== 0,
        adminStatus: AdminStatus.APPROVED,
        ownerId: operator.id,
      },
      create: {
        slug,
        name: companyName,
        accountType: AccountType.EXHIBITOR,
        industry,
        companySize: pick(COMPANY_SIZES, i),
        headquarters: pick(HQ_CITIES, i),
        foundedYear: 2005 + (i % 18),
        website: `https://www.${slug.replace(/-/g, "")}.com`,
        contactEmail: `sales@${slug.replace(/-/g, "")}.com`,
        bio: `${companyName} 专注 ${industry} 领域，为中型及大型企业提供数字化解决方案，本次携核心产品亮相展会。`,
        isVerified: i % 5 !== 0,
        adminStatus: AdminStatus.APPROVED,
        ownerId: operator.id,
      },
    });

    await prisma.user.update({
      where: { id: operator.id },
      data: { orgId: org.id },
    });

    await prisma.orgStaff.upsert({
      where: { orgId_userId: { orgId: org.id, userId: operator.id } },
      update: { role: OrgStaffRole.OWNER, status: InviteStatus.ACCEPTED },
      create: {
        orgId: org.id,
        userId: operator.id,
        role: OrgStaffRole.OWNER,
        status: InviteStatus.ACCEPTED,
        acceptedAt: new Date(),
      },
    });

    await prisma.organizerApplication.upsert({
      where: { orgId: org.id },
      update: { status: ApplicationStatus.APPROVED, reviewedAt: new Date() },
      create: {
        userId: operator.id,
        orgId: org.id,
        orgName: companyName,
        accountType: AccountType.EXHIBITOR,
        contactName: operator.name ?? "销售负责人",
        contactEmail: operator.email,
        contactPhone: phone,
        description: `${companyName} 参展申请（mock 数据）`,
        status: ApplicationStatus.APPROVED,
        reviewedAt: new Date(),
        submittedAt: daysAgo(30),
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: operator.id },
      update: {
        company: companyName,
        industry,
        valueProposition: "展位销售负责人",
        accountStatus: UserAccountStatus.COMPLETE,
      },
      create: {
        userId: operator.id,
        company: companyName,
        industry,
        valueProposition: "展位销售负责人",
        accountStatus: UserAccountStatus.COMPLETE,
      },
    });

    const hallId = halls.get(hall)!;
    const status = pick(statuses, i);

    await prisma.exhibitorBooth.upsert({
      where: { eventId_code: { eventId, code } },
      update: {
        name: `${companyName} 展位`,
        status,
        hallId,
        companyOrgId: org.id,
        operatorUserId: operator.id,
        positionData: pos,
        positionX: pos.x,
        positionY: pos.y,
        hallLabel: hall,
        leadFormConfig: {
          fields: [
            { key: "name", label: "姓名", required: true },
            { key: "company", label: "公司", required: true },
            { key: "phone", label: "手机", required: true },
            { key: "intent", label: "采购意向", required: false },
          ],
          intent_levels: ["A", "B", "C"],
        },
      },
      create: {
        id,
        name: `${companyName} 展位`,
        code,
        status,
        eventId,
        hallId,
        companyOrgId: org.id,
        operatorUserId: operator.id,
        positionData: pos,
        positionX: pos.x,
        positionY: pos.y,
        hallLabel: hall,
        leadFormConfig: {
          fields: [
            { key: "name", label: "姓名", required: true },
            { key: "company", label: "公司", required: true },
            { key: "phone", label: "手机", required: true },
            { key: "intent", label: "采购意向", required: false },
          ],
          intent_levels: ["A", "B", "C"],
        },
      },
    });

    if (n % 10 === 0) {
      console.log(`  … 已创建 ${n}/${BOOTH_COUNT} 个展位`);
    }
  }

  console.log(`✓ ${BOOTH_COUNT} 个展位 + 展商组织（登录手机 13710000001–13710000050）`);
}

async function seedBuyers(
  eventId: string,
  expoOrgId: string,
  boothIds: string[],
  intentTagIds: string[],
  ticketTypeId: string,
) {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const tiers: MemberTier[] = [
    MemberTier.VIP,
    MemberTier.ACTIVE,
    MemberTier.REGULAR,
  ];
  const leadStatuses: LeadStatus[] = [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFIED,
    LeadStatus.WON,
    LeadStatus.LOST,
  ];
  const crmStatuses: CrmSyncStatus[] = [
    CrmSyncStatus.PENDING,
    CrmSyncStatus.SYNCED,
    CrmSyncStatus.FAILED,
  ];
  const inviteStatuses: ParticipantInviteStatus[] = [
    ParticipantInviteStatus.ACTIVATED,
    ParticipantInviteStatus.INVITED,
    ParticipantInviteStatus.CLICKED,
    ParticipantInviteStatus.NOT_INVITED,
  ];

  for (let i = 0; i < BUYER_COUNT; i++) {
    const n = i + 1;
    const id = `${MOCK_BUYER_ID_PREFIX}${String(n).padStart(3, "0")}`;
    const phone = `136200${String(n).padStart(5, "0")}`;
    const name = buyerName(i);
    const company = pick(BUYER_COMPANIES, i);
    const jobTitle = pick(BUYER_TITLES, i);
    const email = `buyer${String(n).padStart(3, "0")}@${company.replace(/\s/g, "").slice(0, 8).toLowerCase()}.com`;

    const user = await prisma.user.upsert({
      where: { email: phoneToEmail(phone) },
      update: {
        phone,
        name,
        userType: UserType.END_USER,
        passwordHash,
      },
      create: {
        email: phoneToEmail(phone),
        phone,
        name,
        passwordHash,
        userType: UserType.END_USER,
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: {
        company,
        industry: pick(EXHIBITOR_INDUSTRIES, i + 5),
        valueProposition: jobTitle,
        accountStatus: UserAccountStatus.COMPLETE,
        intentTags: [
          pick(["SaaS采购", "ERP升级", "营销自动化", "数据平台"], i),
          pick(["Q1立项", "Q2立项", "年度预算"], i + 1),
        ],
        pointsBalance: 100 + (i % 500),
      },
      create: {
        userId: user.id,
        company,
        industry: pick(EXHIBITOR_INDUSTRIES, i + 5),
        valueProposition: jobTitle,
        accountStatus: UserAccountStatus.COMPLETE,
        intentTags: [
          pick(["SaaS采购", "ERP升级", "营销自动化", "数据平台"], i),
          pick(["Q1立项", "Q2立项", "年度预算"], i + 1),
        ],
        pointsBalance: 100 + (i % 500),
      },
    });

    const tier = pick(tiers, i);
    const tagCount = 1 + (i % 3);
    const tags = Array.from({ length: tagCount }, (_, t) =>
      pick(MEMBER_TAGS, i + t),
    );

    await prisma.orgMember.upsert({
      where: { orgId_userId: { orgId: expoOrgId, userId: user.id } },
      update: {
        joinSource: OrgJoinSource.PARTICIPATED_EVENT,
        sourceEventId: eventId,
        tier,
        tags,
        notes: i % 7 === 0 ? "Hosted Buyer 重点客户" : null,
        eventCount: 1 + (i % 4),
        lastActiveAt: daysAgo(i % 14),
        isFollowing: i % 4 === 0,
      },
      create: {
        orgId: expoOrgId,
        userId: user.id,
        joinSource: OrgJoinSource.PARTICIPATED_EVENT,
        sourceEventId: eventId,
        tier,
        tags,
        notes: i % 7 === 0 ? "Hosted Buyer 重点客户" : null,
        eventCount: 1 + (i % 4),
        lastActiveAt: daysAgo(i % 14),
        firstSeenAt: daysAgo(30 + (i % 60)),
        isFollowing: i % 4 === 0,
      },
    });

    await prisma.participant.upsert({
      where: { id },
      update: {
        name,
        email,
        phone,
        company,
        jobTitle,
        badgeQr: `MOCK-EXPO-QR-${String(n).padStart(4, "0")}`,
        role: "ATTENDEE",
        inviteStatus: pick(inviteStatuses, i),
      },
      create: {
        id,
        eventId,
        name,
        email,
        phone,
        company,
        jobTitle,
        badgeQr: `MOCK-EXPO-QR-${String(n).padStart(4, "0")}`,
        role: "ATTENDEE",
        inviteStatus: pick(inviteStatuses, i),
      },
    });

    await prisma.participantRegistration.upsert({
      where: { id: `seed-mock-reg-${String(n).padStart(3, "0")}` },
      update: {
        participantId: id,
        ticketTypeId,
        status: RegistrationStatus.CONFIRMED,
      },
      create: {
        id: `seed-mock-reg-${String(n).padStart(3, "0")}`,
        participantId: id,
        ticketTypeId,
        status: RegistrationStatus.CONFIRMED,
      },
    });

    await prisma.ticket.upsert({
      where: { code: `MOCK-TKT-${String(n).padStart(4, "0")}` },
      update: {
        participantId: id,
        ticketTypeId,
        status: i % 8 === 0 ? TicketStatus.USED : TicketStatus.ISSUED,
      },
      create: {
        ticketTypeId,
        participantId: id,
        code: `MOCK-TKT-${String(n).padStart(4, "0")}`,
        status: i % 8 === 0 ? TicketStatus.USED : TicketStatus.ISSUED,
      },
    });

    if (i % 5 !== 0) {
      await prisma.checkIn.upsert({
        where: { id: `seed-mock-checkin-${String(n).padStart(3, "0")}` },
        update: {
          eventId,
          participantId: id,
          method: i % 3 === 0 ? "qr_scan" : "manual",
          checkedInAt: daysAgo(i % 3, i % 12),
        },
        create: {
          id: `seed-mock-checkin-${String(n).padStart(3, "0")}`,
          eventId,
          participantId: id,
          method: i % 3 === 0 ? "qr_scan" : "manual",
          checkedInAt: daysAgo(i % 3, i % 12),
        },
      });
    }

    const leadCount = 1 + (i % 3);
    for (let l = 0; l < leadCount; l++) {
      const boothId = boothIds[hashIndex(i * 17 + l * 31, boothIds.length)]!;
      const intentGrade =
        i < 25 ? "A" : i < 65 ? "B" : "C";
      const tagSlice = intentTagIds.slice(
        hashIndex(i + l, intentTagIds.length),
        hashIndex(i + l, intentTagIds.length) + 1 + (l % 2),
      );

      await prisma.lead.upsert({
        where: { id: `seed-mock-lead-${String(n).padStart(3, "0")}-${l}` },
        update: {
          boothId,
          participantId: id,
          status: pick(leadStatuses, i + l),
          intentGrade,
          notes: pick(LEAD_NOTES, i + l),
          crmSyncStatus: pick(crmStatuses, i),
          crmSyncedAt: i % 3 === 0 ? daysAgo(1) : null,
        },
        create: {
          id: `seed-mock-lead-${String(n).padStart(3, "0")}-${l}`,
          boothId,
          participantId: id,
          status: pick(leadStatuses, i + l),
          intentGrade,
          notes: pick(LEAD_NOTES, i + l),
          crmSyncStatus: pick(crmStatuses, i),
          crmSyncedAt: i % 3 === 0 ? daysAgo(1) : null,
          intentTags: {
            create: tagSlice.map((intentTagId) => ({ intentTagId })),
          },
        },
      });
    }

    if (n % 20 === 0) {
      console.log(`  … 已创建 ${n}/${BUYER_COUNT} 位买家`);
    }
  }

  console.log(`✓ ${BUYER_COUNT} 位采购商（登录手机 13620000001–13620000100，密码 ${SEED_PASSWORD}）`);
}

async function main() {
  const cleanOnly = process.argv.includes("--clean");

  if (cleanOnly) {
    await cleanMockData();
    return;
  }

  const event = await prisma.event.findUnique({
    where: { slug: EVENT_SLUG },
    select: { id: true, name: true, orgId: true, organizerId: true },
  });

  if (!event?.orgId) {
    throw new Error(
      `未找到活动「${EVENT_SLUG}」，请先运行 pnpm --filter @connectiq/database db:seed`,
    );
  }

  console.log(`\n📦 为展会「${event.name}」生成 Mock 数据…\n`);

  await cleanMockData();

  // 清除该展会下旧展位（含 seed 自带的 3 个），确保恰好 50 个 mock 展位
  await prisma.lead.deleteMany({ where: { booth: { eventId: event.id } } });
  await prisma.exhibitorBooth.deleteMany({ where: { eventId: event.id } });

  const hallDefs = [
    { name: "A 馆", floor: "1F" },
    { name: "B 馆", floor: "2F" },
    { name: "C 馆", floor: "3F" },
  ];
  const halls = new Map<string, string>();
  for (const h of hallDefs) {
    const existing = await prisma.expoHall.findFirst({
      where: { eventId: event.id, name: h.name },
    });
    const hall =
      existing ??
      (await prisma.expoHall.create({
        data: { eventId: event.id, name: h.name, floor: h.floor },
      }));
    halls.set(h.name, hall.id);
  }

  await seedExhibitorBooths(event.id, event.orgId, halls);

  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId: event.id },
    orderBy: { code: "asc" },
    select: { id: true },
  });

  const intentTags = await prisma.intentTag.findMany({
    where: { eventId: event.id },
    select: { id: true },
  });

  const ticketType = await prisma.ticketType.upsert({
    where: { id: "seed-mock-buyer-ticket" },
    update: { name: "采购商通行证", price: 0, quota: 500 },
    create: {
      id: "seed-mock-buyer-ticket",
      eventId: event.id,
      name: "采购商通行证",
      price: 0,
      quota: 500,
    },
  });

  await seedBuyers(
    event.id,
    event.orgId,
    booths.map((b) => b.id),
    intentTags.map((t) => t.id),
    ticketType.id,
  );

  await prisma.stampRally.upsert({
    where: { id: "seed-stamp-rally-expo" },
    update: {
      boothIds: booths.map((b) => b.id),
      totalBooths: booths.length,
      requiredCount: Math.min(10, booths.length),
      status: StampRallyStatus.ACTIVE,
    },
    create: {
      id: "seed-stamp-rally-expo",
      eventId: event.id,
      createdById: event.organizerId,
      name: "2025 展会集章之旅",
      description: "逛满 10 个展位即可兑换礼品",
      prize: "Apple AirPods Pro",
      requiredCount: Math.min(10, booths.length),
      totalBooths: booths.length,
      boothIds: booths.map((b) => b.id),
      status: StampRallyStatus.ACTIVE,
    },
  });

  const memberCount = await prisma.orgMember.count({
    where: { orgId: event.orgId },
  });
  await prisma.organization.update({
    where: { id: event.orgId },
    data: { memberCount },
  });

  const leadCount = await prisma.lead.count({
    where: { booth: { eventId: event.id } },
  });
  const checkInCount = await prisma.checkIn.count({
    where: { eventId: event.id },
  });

  console.log("\n✅ 展会 Mock 数据完成\n");
  console.log("── 数据概览 ──");
  console.log(`  展位:     ${booths.length}`);
  console.log(`  采购商:   ${BUYER_COUNT}`);
  console.log(`  线索:     ${leadCount}`);
  console.log(`  签到:     ${checkInCount}`);
  console.log(`  意向标签: ${intentTags.length}`);
  console.log("\n── 登录测试 ──");
  console.log(`  展览主办方: 13800000003 / ${SEED_PASSWORD}`);
  console.log(`  展商示例:   13710000001 / ${SEED_PASSWORD}`);
  console.log(`  买家示例:   13620000001 / ${SEED_PASSWORD}`);
  console.log(`  活动 slug:  ${EVENT_SLUG}`);
  console.log("\n── 清除 mock 数据 ──");
  console.log("  pnpm --filter @connectiq/database db:seed:expo-mock -- --clean\n");
}

main()
  .catch((err) => {
    console.error("❌ seed-expo-mock 失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
