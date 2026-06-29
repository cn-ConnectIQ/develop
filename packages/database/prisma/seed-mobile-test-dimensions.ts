/**
 * 13770626459 全维度测试数据（依赖完整 seed 后的演示实体）
 * 活动码 TEST1377 → 智链未来产业博览会 2026
 */
import {
  AccountType,
  AdminStatus,
  ConnectionSource,
  ConnectionStatus,
  ExchangeStatus,
  FeedItemType,
  InteractionOwnerType,
  InviteStatus,
  LotteryEntrySource,
  LotteryStatus,
  LotteryType,
  MeetingStatus,
  OrgStaffRole,
  PointsReason,
  PollStatus,
  PollType,
  ReferralStatus,
  SignalType,
  StampRallyStatus,
  SnSessionStatus,
  BoothStatus,
  EventStatus,
  ReviewStatus,
  UserAccountStatus,
  UserRole,
  UserType,
} from "@prisma/client";
import { prisma } from "../src/client";
import { SEED_INT } from "./seed-interactions";

/** 与 seed-mobile-test-attendee 保持一致 */
const MOBILE_TEST_PHONE = "13770626459";
const MOBILE_TEST_NAME = "钱测试";

/** 专用测试活动码 → 智链未来产业博览会 2026（LIVE，功能最全） */
export const MOBILE_TEST_JOIN_CODE = "TEST1377";
export const MOBILE_TEST_PRIMARY_EVENT_SLUG = "smart-link-industry-expo-2026";

/** 生产/预览环境 TEST1377 活动 ID（与 slug 解析互为兜底） */
export const MOBILE_TEST_PRODUCTION_EVENT_ID = "cmqurkwkt001rzcpbzojv2mi4";

const PREFIX = "seed-m1377";
const MOBILE_TEST_EXHIBITOR_ORG_SLUG = "mobile-test-qian-exhibitor";
const MOBILE_TEST_BOOTH_ID = `${PREFIX}-booth-qian-test`;
const MOBILE_TEST_BOOTH_CODE = "T1377-Q";

const SEED_INT_HOSTED = {
  lotteryRandom: SEED_INT.hostedExpo.lotteryRandom,
  lotteryCheckin: SEED_INT.hostedExpo.lotteryCheckin,
  lotteryActivity: SEED_INT.hostedExpo.lotteryActivity,
  lotteryQuiz: SEED_INT.hostedExpo.lotteryQuiz,
  lotteryFinished: SEED_INT.hostedExpo.lotteryRandomFinished,
  pollSingle: SEED_INT.hostedExpo.pollSingle,
  pollSingleOpt1: SEED_INT.hostedExpo.pollSingleOpt1,
  pollMulti: SEED_INT.hostedExpo.pollMulti,
  pollMultiO1: SEED_INT.hostedExpo.pollMultiO1,
  pollMultiO2: SEED_INT.hostedExpo.pollMultiO2,
  pollWordCloud: SEED_INT.hostedExpo.pollWordCloud,
  pollRating: SEED_INT.hostedExpo.pollRating,
  pollQna: SEED_INT.hostedExpo.pollQna,
  pollQuiz: SEED_INT.hostedExpo.pollQuiz,
  pollQuizO2: SEED_INT.hostedExpo.pollQuizO2,
  pollAnnouncement: SEED_INT.hostedExpo.pollAnnouncement,
  sessionCodePoll: SEED_INT.hostedExpo.sessionCodePoll,
  sessionCodeLottery: SEED_INT.hostedExpo.sessionCodeLottery,
  stampRally: "seed-feat-stamp-hosted-expo",
  test1377Lottery: `${PREFIX}-lottery-live`,
  test1377Session: `${PREFIX}-session-lottery`,
  test1377SurveyPoll: `${PREFIX}-poll-survey`,
} as const;

const TEST1377_LOTTERY_PRIZES = [
  { rank: 1, name: "一等奖 · MacBook Air" },
  { rank: 2, name: "二等奖 · iPad" },
  { rank: 3, name: "三等奖 · ConnectIQ 周边礼盒" },
];

const STAMP_RALLY_TARGET = 12;
const STAMP_RALLY_STAMPED = 6;

const EXTRA_BOOTH_SPECS = [
  { code: "A-104", name: "智链工业软件", x: 50, y: 10 },
  { code: "A-105", name: "华东自动化", x: 8, y: 24 },
  { code: "A-106", name: "云智造科技", x: 22, y: 24 },
  { code: "A-107", name: "数智营销云", x: 36, y: 24 },
  { code: "A-108", name: "企服优选馆", x: 50, y: 24 },
  { code: "A-109", name: "AI 应用工坊", x: 8, y: 38 },
  { code: "A-110", name: "供应链数字化", x: 22, y: 38 },
  { code: "A-111", name: "工业物联网", x: 36, y: 38 },
  { code: "A-112", name: "MarTech 创新站", x: 50, y: 38 },
] as const;

const PEER_INTENT_SPECS = [
  {
    phone: "13900000001",
    role: "CEO",
    supplyTags: ["CRM 软件", "SaaS 产品"],
    demandTags: ["营销自动化", "渠道合作"],
    topics: ["B2B 增长"],
  },
  {
    phone: "13900000002",
    role: "销售总监",
    supplyTags: ["MarTech 工具", "活动运营"],
    demandTags: ["B2B 获客", "CRM 软件"],
    topics: ["私域运营"],
  },
  {
    phone: "13900000003",
    role: "市场负责人",
    supplyTags: ["会展 SaaS", "签到系统"],
    demandTags: ["大型展会主办方", "营销自动化"],
    topics: ["活动科技"],
  },
  {
    phone: "13900000004",
    role: "产品经理",
    supplyTags: ["数据分析", "用户增长"],
    demandTags: ["MarTech 方案", "A/B 测试工具"],
    topics: ["产品增长"],
  },
  {
    phone: "13900000005",
    role: "投资经理",
    supplyTags: ["产业基金"],
    demandTags: ["A 轮 SaaS", "工业软件"],
    topics: ["企业服务投资"],
  },
  {
    phone: "13900000006",
    role: "运营总监",
    supplyTags: ["私域运营", "SCRM"],
    demandTags: ["CRM 软件", "营销自动化"],
    topics: ["客户成功"],
  },
] as const;

const EXTRA_ANNOUNCEMENTS = [
  {
    id: `${PREFIX}-ann-parking`,
    title: "【公告】P3 停车场已满，请前往 P5 备用停车区",
  },
  {
    id: `${PREFIX}-ann-lottery`,
    title: "【公告】16:30 主舞台抽奖即将开始，请提前到场",
  },
  {
    id: `${PREFIX}-ann-networking`,
    title: "【公告】商务洽谈区 B 区现已开放，欢迎预约 1v1",
  },
  {
    id: `${PREFIX}-ann-catering`,
    title: "【公告】午餐供应至 13:30，请移步 2 号馆餐饮区",
  },
] as const;

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * 3_600_000);
}

function avatarSeedUrl(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}

const SEED_MTG_TABLE = "seed-mtg-table-hosted-a-01";

function daysAgo(days: number, hours = 10) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

function daysFromNow(days: number, hours = 18) {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
}

/** TEST1377 活动保持「进行中」：LIVE 状态 + 日期覆盖当前 */
async function ensureMobileTestEventLive() {
  const startDate = daysAgo(1);
  const endDate = daysFromNow(2);
  const data = {
    status: EventStatus.LIVE,
    reviewStatus: ReviewStatus.LIVE,
    startDate,
    endDate,
  };

  const updated: string[] = [];

  try {
    const byId = await prisma.event.update({
      where: { id: MOBILE_TEST_PRODUCTION_EVENT_ID },
      data,
      select: { id: true, name: true },
    });
    updated.push(`${byId.name} (${byId.id})`);
  } catch {
    // 生产 ID 不存在时跳过
  }

  try {
    const bySlug = await prisma.event.findUnique({
      where: { slug: MOBILE_TEST_PRIMARY_EVENT_SLUG },
      select: { id: true, name: true },
    });
    if (bySlug && bySlug.id !== MOBILE_TEST_PRODUCTION_EVENT_ID) {
      await prisma.event.update({
        where: { id: bySlug.id },
        data,
      });
      updated.push(`${bySlug.name} (${bySlug.id})`);
    }
  } catch {
    // slug 不存在时跳过
  }

  return updated;
}

function slotToday(hour: number, minute: number, durationMinutes = 20) {
  const start = new Date();
  start.setHours(hour, minute, 0, 0);
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  return { start, end };
}

async function findPeer(phone: string) {
  return prisma.user.findFirst({
    where: { phone },
    select: {
      id: true,
      name: true,
      profile: { select: { company: true, valueProposition: true } },
    },
  });
}

async function ensureHostedExpoMobileFeatures(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { featureFlags: true, organizerId: true },
  });
  if (!event) return { organizerId: null as string | null };

  const flags =
    event.featureFlags && typeof event.featureFlags === "object"
      ? (event.featureFlags as Record<string, boolean>)
      : {};

  await prisma.event.update({
    where: { id: eventId },
    data: {
      featureFlags: {
        lottery: true,
        stampRally: true,
        boothRanking: true,
        eventSummary: true,
        speedNetworking: true,
        aiBoothRoute: true,
        aiReferral: true,
        highValueBuyerPush: true,
        inviteSystem: true,
        ...flags,
      },
    },
  });

  return { organizerId: event.organizerId };
}

async function ensureSpeedNetworkingFlags(eventIds: string[]) {
  const uniqueIds = [...new Set(eventIds.filter(Boolean))];
  for (const eventId of uniqueIds) {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { featureFlags: true },
    });
    if (!event) continue;

    const flags =
      event.featureFlags && typeof event.featureFlags === "object"
        ? (event.featureFlags as Record<string, boolean>)
        : {};

    await prisma.event.update({
      where: { id: eventId },
      data: {
        featureFlags: {
          ...flags,
          speedNetworking: true,
        },
      },
    });
  }
}

async function ensureTest1377SurveyPoll(eventId: string, creatorId: string) {
  await prisma.poll.upsert({
    where: { id: SEED_INT_HOSTED.test1377SurveyPoll },
    update: {
      title: "【满意度】您对本次活动的整体评价",
      type: PollType.SURVEY,
      status: PollStatus.LIVE,
    },
    create: {
      id: SEED_INT_HOSTED.test1377SurveyPoll,
      eventId,
      createdById: creatorId,
      type: PollType.SURVEY,
      title: "【满意度】您对本次活动的整体评价",
      status: PollStatus.LIVE,
      displayOrder: 0,
      showResults: true,
    },
  });
}

async function ensureExtraExpoBooths(eventId: string) {
  const template = await prisma.exhibitorBooth.findFirst({
    where: { eventId, code: "A-101" },
    select: {
      hallId: true,
      companyOrgId: true,
      operatorUserId: true,
      hallLabel: true,
    },
  });
  if (!template?.companyOrgId) return [];

  const orgIds = await prisma.exhibitorBooth
    .findMany({
      where: { eventId },
      select: { companyOrgId: true },
      distinct: ["companyOrgId"],
    })
    .then((rows) => rows.map((r) => r.companyOrgId));

  const created: { id: string; code: string }[] = [];
  for (const spec of EXTRA_BOOTH_SPECS) {
    const orgId = orgIds[created.length % orgIds.length] ?? template.companyOrgId;
    const booth = await prisma.exhibitorBooth.upsert({
      where: { eventId_code: { eventId, code: spec.code } },
      update: {
        name: spec.name,
        positionX: spec.x,
        positionY: spec.y,
        status: BoothStatus.OCCUPIED,
      },
      create: {
        id: `${PREFIX}-booth-${spec.code.replace(/[^a-z0-9]/gi, "")}`,
        eventId,
        code: spec.code,
        name: spec.name,
        hallId: template.hallId,
        hallLabel: template.hallLabel ?? "1 号馆",
        companyOrgId: orgId,
        operatorUserId: template.operatorUserId,
        positionX: spec.x,
        positionY: spec.y,
        status: BoothStatus.OCCUPIED,
      },
      select: { id: true, code: true },
    });
    created.push(booth);
  }
  return created;
}

/** 13770626459 升级为主办方 + 展商双角色（保留参会者数据） */
async function ensureMobileTestAdminRoles(
  userId: string,
  eventId: string,
): Promise<string[]> {
  const labels: string[] = [];

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, orgId: true, organizerId: true },
  });
  if (!event?.orgId) {
    return labels;
  }

  await prisma.organization.update({
    where: { id: event.orgId },
    data: {
      adminStatus: AdminStatus.APPROVED,
      isVerified: true,
    },
  });

  await prisma.user.update({
    where: { id: userId },
    data: {
      userType: UserType.ACCOUNT_ADMIN,
      orgId: event.orgId,
    },
  });

  await prisma.orgStaff.upsert({
    where: { orgId_userId: { orgId: event.orgId, userId } },
    update: {
      role: OrgStaffRole.OWNER,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
    create: {
      orgId: event.orgId,
      userId,
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
      where: { userId, role, entityId: null },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({ data: { userId, role } });
    }
  }

  labels.push("主办方(活动组织)");

  const exhibitorOrg = await prisma.organization.upsert({
    where: { slug: MOBILE_TEST_EXHIBITOR_ORG_SLUG },
    update: {
      name: "钱测试参展部",
      accountType: AccountType.EXHIBITOR,
      adminStatus: AdminStatus.APPROVED,
      isVerified: true,
    },
    create: {
      name: "钱测试参展部",
      slug: MOBILE_TEST_EXHIBITOR_ORG_SLUG,
      accountType: AccountType.EXHIBITOR,
      adminStatus: AdminStatus.APPROVED,
      isVerified: true,
      bio: "TEST1377 联调专用展商组织",
    },
  });

  await prisma.orgStaff.upsert({
    where: { orgId_userId: { orgId: exhibitorOrg.id, userId } },
    update: {
      role: OrgStaffRole.OWNER,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
    create: {
      orgId: exhibitorOrg.id,
      userId,
      role: OrgStaffRole.OWNER,
      status: InviteStatus.ACCEPTED,
      acceptedAt: new Date(),
    },
  });

  const boothTemplate = await prisma.exhibitorBooth.findFirst({
    where: { eventId },
    select: { hallId: true, hallLabel: true },
  });

  await prisma.exhibitorBooth.upsert({
    where: { id: MOBILE_TEST_BOOTH_ID },
    update: {
      name: "钱测试联调展位",
      code: MOBILE_TEST_BOOTH_CODE,
      companyOrgId: exhibitorOrg.id,
      operatorUserId: userId,
      status: BoothStatus.OCCUPIED,
    },
    create: {
      id: MOBILE_TEST_BOOTH_ID,
      eventId,
      code: MOBILE_TEST_BOOTH_CODE,
      name: "钱测试联调展位",
      hallId: boothTemplate?.hallId ?? undefined,
      hallLabel: boothTemplate?.hallLabel ?? "1 号馆",
      companyOrgId: exhibitorOrg.id,
      operatorUserId: userId,
      status: BoothStatus.OCCUPIED,
      positionX: 48,
      positionY: 14,
    },
  });

  const exhibitorAssignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId,
      role: UserRole.EXHIBITOR,
      entityId: MOBILE_TEST_BOOTH_ID,
    },
  });
  if (!exhibitorAssignment) {
    await prisma.userRoleAssignment.create({
      data: {
        userId,
        role: UserRole.EXHIBITOR,
        entityId: MOBILE_TEST_BOOTH_ID,
      },
    });
  }

  labels.push(`展商(展位 ${MOBILE_TEST_BOOTH_CODE})`);
  return labels;
}

async function ensureLivePollCountdown() {
  const closesAt = hoursFromNow(2);
  await prisma.poll.updateMany({
    where: {
      id: {
        in: [SEED_INT_HOSTED.pollSingle, SEED_INT_HOSTED.pollMulti],
      },
      status: PollStatus.LIVE,
    },
    data: { closesAt },
  });
}

async function ensureExtraAnnouncements(eventId: string, creatorId: string) {
  for (const [index, ann] of EXTRA_ANNOUNCEMENTS.entries()) {
    await prisma.poll.upsert({
      where: { id: ann.id },
      update: {
        title: ann.title,
        status: PollStatus.LIVE,
        type: PollType.ANNOUNCEMENT,
      },
      create: {
        id: ann.id,
        eventId,
        createdById: creatorId,
        type: PollType.ANNOUNCEMENT,
        title: ann.title,
        status: PollStatus.LIVE,
        showResults: false,
        displayOrder: 20 + index,
      },
    });
  }
}

async function ensurePeerAvatarsAndIntents(eventId: string) {
  for (const spec of PEER_INTENT_SPECS) {
    const peer = await prisma.user.findFirst({
      where: { phone: spec.phone },
      select: { id: true },
    });
    if (!peer) continue;

    await prisma.fileAsset.upsert({
      where: { id: `${PREFIX}-avatar-${spec.phone}` },
      update: { url: avatarSeedUrl(spec.phone) },
      create: {
        id: `${PREFIX}-avatar-${spec.phone}`,
        uploaderId: peer.id,
        url: avatarSeedUrl(spec.phone),
        filename: `avatar-${spec.phone}.svg`,
        mimeType: "image/svg+xml",
        size: 4096,
      },
    });

    await prisma.userEventIntent.upsert({
      where: { userId_eventId: { userId: peer.id, eventId } },
      update: {
        role: spec.role,
        supplyTags: [...spec.supplyTags],
        demandTags: [...spec.demandTags],
        topics: [...spec.topics],
      },
      create: {
        id: `${PREFIX}-intent-${spec.phone}`,
        userId: peer.id,
        eventId,
        role: spec.role,
        supplyTags: [...spec.supplyTags],
        demandTags: [...spec.demandTags],
        topics: [...spec.topics],
      },
    });
  }
}

async function ensurePublicEventPresentation(eventId: string, orgId: string | null) {
  await prisma.event.update({
    where: { id: eventId },
    data: {
      description:
        "ConnectIQ 创新中心主办的 B2B 产业展会，覆盖智能制造、企业服务与 MarTech 三大展区。现场含主论坛、SN 速配、集章互动与 AI 商务引荐。",
      location: "上海 · 国家会展中心（虹桥）",
    },
  });

  if (orgId) {
    await prisma.organization.update({
      where: { id: orgId },
      data: {
        logoUrl:
          "https://api.dicebear.com/7.x/shapes/svg?seed=connectiq-org",
        coverUrl:
          "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop",
        isVerified: true,
      },
    });
  }

  const agendaSpecs = [
    {
      id: `${PREFIX}-agenda-opening`,
      title: "开幕主论坛 · 智链未来",
      room: "主舞台 A 区",
      hour: 9,
      minute: 30,
      durationMin: 90,
    },
    {
      id: `${PREFIX}-agenda-martech`,
      title: "MarTech 创新圆桌",
      room: "B2B 洽谈区",
      hour: 11,
      minute: 0,
      durationMin: 60,
    },
    {
      id: `${PREFIX}-agenda-sn`,
      title: "Speed Networking 速配专场",
      room: "SN 专区 C 区",
      hour: 14,
      minute: 0,
      durationMin: 120,
    },
    {
      id: `${PREFIX}-agenda-closing`,
      title: "闭幕抽奖与展商答谢",
      room: "主舞台 A 区",
      hour: 16,
      minute: 30,
      durationMin: 45,
    },
  ] as const;

  const base = new Date();
  base.setHours(0, 0, 0, 0);

  for (const spec of agendaSpecs) {
    const start = new Date(base);
    start.setHours(spec.hour, spec.minute, 0, 0);
    const end = new Date(start.getTime() + spec.durationMin * 60_000);
    await prisma.session.upsert({
      where: { id: spec.id },
      update: {
        title: spec.title,
        room: spec.room,
        startTime: start,
        endTime: end,
      },
      create: {
        id: spec.id,
        eventId,
        title: spec.title,
        room: spec.room,
        startTime: start,
        endTime: end,
      },
    });
  }
}

async function ensureEventSpeakers(eventId: string) {
  const specs = [
    {
      id: `${PREFIX}-speaker-1`,
      name: "王建国",
      title: "腾讯云副总裁 · 产业互联网",
      bio: "专注 B2B 数字化与企业服务二十年，主论坛分享「智链未来」主题演讲。",
      seed: "speaker-wjg",
    },
    {
      id: `${PREFIX}-speaker-2`,
      name: "陈雅琳",
      title: "MarTech 创新实验室负责人",
      bio: "深耕营销自动化与渠道增长，圆桌环节分享出海 MarTech 最佳实践。",
      seed: "speaker-cyl",
    },
    {
      id: `${PREFIX}-speaker-3`,
      name: "李明远",
      title: "ConnectIQ 产品总监",
      bio: "负责 AI 商务匹配与 SN 速配产品，现场演示 Connect Card 与引荐引擎。",
      seed: "speaker-lmy",
    },
  ] as const;

  for (const spec of specs) {
    await prisma.speaker.upsert({
      where: { id: spec.id },
      update: {
        name: spec.name,
        title: spec.title,
        bio: spec.bio,
        avatarUrl: avatarSeedUrl(spec.seed),
      },
      create: {
        id: spec.id,
        eventId,
        name: spec.name,
        title: spec.title,
        bio: spec.bio,
        avatarUrl: avatarSeedUrl(spec.seed),
      },
    });
  }
}

async function ensureTest1377SnSession(
  eventId: string,
  participantId: string,
  counterpartyParticipantId: string,
) {
  const sessionId = `${PREFIX}-sn-session`;
  const startedAt = new Date(Date.now() - 8 * 60_000);

  await prisma.snSession.upsert({
    where: { id: sessionId },
    update: {
      status: SnSessionStatus.IN_PROGRESS,
      roundCount: 3,
      startedAt,
      eventId,
    },
    create: {
      id: sessionId,
      eventId,
      status: SnSessionStatus.IN_PROGRESS,
      roundCount: 3,
      startedAt,
    },
  });

  await prisma.snPair.upsert({
    where: { id: `${PREFIX}-sn-pair-1` },
    update: {
      sessionId,
      participantAId: participantId,
      participantBId: counterpartyParticipantId,
      round: 1,
    },
    create: {
      id: `${PREFIX}-sn-pair-1`,
      sessionId,
      participantAId: participantId,
      participantBId: counterpartyParticipantId,
      round: 1,
      connectionEstablished: false,
    },
  });
}

async function ensureSchemaCompat() {
  const statements = [
    `ALTER TYPE "PollType" ADD VALUE IF NOT EXISTS 'SURVEY'`,
    `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS requester_rating INT`,
    `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recipient_rating INT`,
    `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS requester_rating_comment TEXT`,
    `ALTER TABLE meetings ADD COLUMN IF NOT EXISTS recipient_rating_comment TEXT`,
    `ALTER TABLE user_event_intents ADD COLUMN IF NOT EXISTS industry TEXT`,
  ];
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // 部分托管库不支持 IF NOT EXISTS，忽略
    }
  }
}

async function resolveMobileTestEvent() {
  const byId = await prisma.event.findUnique({
    where: { id: MOBILE_TEST_PRODUCTION_EVENT_ID },
    select: { id: true, name: true, startDate: true },
  });
  if (byId) return byId;

  const bySlug = await prisma.event.findUnique({
    where: { slug: MOBILE_TEST_PRIMARY_EVENT_SLUG },
    select: { id: true, name: true, startDate: true },
  });
  if (bySlug) return bySlug;

  throw new Error(
    `缺少测试活动（ID ${MOBILE_TEST_PRODUCTION_EVENT_ID} 或 slug ${MOBILE_TEST_PRIMARY_EVENT_SLUG}）`,
  );
}

function stampRallyIdForEvent(eventId: string) {
  return `${PREFIX}-stamp-rally-${eventId.slice(-8)}`;
}

async function ensureCommunityPostsSeed(
  eventId: string,
  userId: string,
  peers: Array<{ id: string; name: string; phone: string }>,
) {
  const posts = [
    {
      id: `${PREFIX}-cp-1`,
      author_user_id: peers[0]?.id ?? userId,
      author_name: peers[0]?.name ?? "张伟",
      author_avatar: peers[0] ? avatarSeedUrl(peers[0].phone) : undefined,
      content: "主论坛的工业软件圆桌有没有回放？想回去给团队分享。",
      topic: "论坛",
      like_count: 12,
      comment_count: 3,
      created_at: daysAgo(0, 2).toISOString(),
    },
    {
      id: `${PREFIX}-cp-2`,
      author_user_id: peers[1]?.id ?? userId,
      author_name: peers[1]?.name ?? "李娜",
      author_avatar: peers[1] ? avatarSeedUrl(peers[1].phone) : undefined,
      content: "A-101 展位的 CRM 演示很清晰，有做渠道代理的朋友可以一起聊聊。",
      topic: "展位",
      like_count: 8,
      comment_count: 1,
      created_at: daysAgo(0, 4).toISOString(),
    },
    {
      id: `${PREFIX}-cp-3`,
      author_user_id: userId,
      author_name: MOBILE_TEST_NAME,
      content: "下午有没有想一起逛营销自动化展区的？可以结对扫码集章。",
      topic: "组队",
      like_count: 5,
      comment_count: 0,
      created_at: daysAgo(0, 1).toISOString(),
    },
  ];
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: "community_posts" } },
    create: { eventId, key: "community_posts", value: posts },
    update: { value: posts },
  });
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: "community_icebreakers" } },
    create: {
      eventId,
      key: "community_icebreakers",
      value: [
        "你今天是带着什么采购/合作目标来的？",
        "现场哪场论坛最值得推荐？",
        "有没有想一起结对逛展的？",
      ],
    },
    update: {
      value: [
        "你今天是带着什么采购/合作目标来的？",
        "现场哪场论坛最值得推荐？",
        "有没有想一起结对逛展的？",
      ],
    },
  });
}

async function ensureStampRallyProgress(
  eventId: string,
  userId: string,
  creatorId: string,
) {
  const allBooths = await prisma.exhibitorBooth.findMany({
    where: { eventId },
    orderBy: { code: "asc" },
    select: { id: true, code: true },
  });
  if (allBooths.length === 0) return;

  const boothIds = allBooths.map((b) => b.id);
  const requiredCount = Math.min(STAMP_RALLY_TARGET, boothIds.length);
  const rallyId = stampRallyIdForEvent(eventId);

  await prisma.stampRally.upsert({
    where: { id: rallyId },
    update: {
      status: StampRallyStatus.ACTIVE,
      eventId,
      boothIds,
      totalBooths: boothIds.length,
      requiredCount,
      prize: "ConnectIQ 限定礼盒 + 现场抽奖资格",
    },
    create: {
      id: rallyId,
      eventId,
      createdById: creatorId,
      name: "智链博览会集章之旅",
      description: "逛遍精品展位，集满印章兑换好礼",
      prize: "ConnectIQ 限定礼盒 + 现场抽奖资格",
      requiredCount,
      totalBooths: boothIds.length,
      boothIds,
      status: StampRallyStatus.ACTIVE,
    },
  });

  const stampTargets = allBooths.slice(0, STAMP_RALLY_STAMPED);
  for (const booth of stampTargets) {
    await prisma.stampRecord.upsert({
      where: {
        rallyId_userId_boothId: {
          rallyId,
          userId,
          boothId: booth.id,
        },
      },
      update: {},
      create: {
        id: `${PREFIX}-stamp-${rallyId.slice(-6)}-${booth.code.replace(/[^a-z0-9]/gi, "")}`,
        rallyId,
        userId,
        boothId: booth.id,
      },
    });
  }
}

async function ensureTest1377LiveLottery(
  eventId: string,
  creatorId: string,
  userId: string,
) {
  await prisma.lottery.upsert({
    where: { id: SEED_INT_HOSTED.test1377Lottery },
    update: {
      status: LotteryStatus.OPEN,
      title: "【TEST1377】现场幸运大抽奖",
      entryCount: 1,
    },
    create: {
      id: SEED_INT_HOSTED.test1377Lottery,
      eventId,
      createdById: creatorId,
      title: "【TEST1377】现场幸运大抽奖",
      description: "联调专用 · 扫码 T1377L 或小程序直接进入参与",
      type: LotteryType.RANDOM,
      status: LotteryStatus.OPEN,
      prizes: TEST1377_LOTTERY_PRIZES,
      winnerCount: 3,
      entryCount: 0,
    },
  });

  await prisma.interactionSession.upsert({
    where: { id: SEED_INT_HOSTED.test1377Session },
    update: {
      isActive: true,
      sessionCode: "T1377L",
      interactions: [{ type: "lottery", id: SEED_INT_HOSTED.test1377Lottery }],
      scanCount: 56,
      participantCount: 12,
    },
    create: {
      id: SEED_INT_HOSTED.test1377Session,
      eventId,
      createdById: creatorId,
      name: "TEST1377 现场抽奖",
      sessionCode: "T1377L",
      interactions: [{ type: "lottery", id: SEED_INT_HOSTED.test1377Lottery }],
      ownerType: InteractionOwnerType.ORGANIZER,
      isActive: true,
      scanCount: 56,
      participantCount: 12,
    },
  });

  await prisma.lotteryEntry.upsert({
    where: {
      lotteryId_userId: {
        lotteryId: SEED_INT_HOSTED.test1377Lottery,
        userId,
      },
    },
    update: {},
    create: {
      id: `${PREFIX}-lottery-test1377-entry`,
      lotteryId: SEED_INT_HOSTED.test1377Lottery,
      userId,
      source: LotteryEntrySource.MANUAL,
    },
  });
}

async function ensureMobileTestInteractions(
  eventId: string,
  userId: string,
  participantId: string,
  creatorId: string,
): Promise<string[]> {
  const labels: string[] = [];
  const H = SEED_INT_HOSTED;

  await ensureTest1377LiveLottery(eventId, creatorId, userId);
  labels.push("TEST1377 专属抽奖(T1377L)");

  await ensureTest1377SurveyPoll(eventId, creatorId);
  labels.push("满意度问卷(SURVEY·LIVE)");

  const baselinePoll = await prisma.poll.findUnique({
    where: { id: H.pollSingle },
    select: { id: true },
  });
  if (!baselinePoll) {
    labels.push("互动套件(需先 pnpm db:seed:interactions)");
    return labels;
  }

  const lotterySpecs = [
    { id: H.lotteryRandom, entryId: `${PREFIX}-lottery-random`, source: LotteryEntrySource.MANUAL },
    { id: H.lotteryCheckin, entryId: `${PREFIX}-lottery-checkin`, source: LotteryEntrySource.AUTO_CHECKIN },
    { id: H.lotteryActivity, entryId: `${PREFIX}-lottery-activity`, source: LotteryEntrySource.AUTO_ACTIVITY },
    { id: H.lotteryQuiz, entryId: `${PREFIX}-lottery-quiz`, source: LotteryEntrySource.AUTO_ACTIVITY },
  ] as const;

  let lotteryCount = 0;
  for (const spec of lotterySpecs) {
    const lottery = await prisma.lottery.findUnique({
      where: { id: spec.id },
      select: { id: true, status: true },
    });
    if (!lottery) continue;

    await prisma.lottery.update({
      where: { id: spec.id },
      data: { status: LotteryStatus.OPEN },
    });

    await prisma.lotteryEntry.upsert({
      where: { lotteryId_userId: { lotteryId: spec.id, userId } },
      update: { source: spec.source },
      create: {
        id: spec.entryId,
        lotteryId: spec.id,
        userId,
        source: spec.source,
      },
    });
    lotteryCount += 1;
  }
  if (lotteryCount > 0) {
    labels.push(`抽奖参与(${lotteryCount + 1} 场含 TEST1377)`);
  }

  const finishedLottery = await prisma.lottery.findUnique({
    where: { id: H.lotteryFinished },
    select: { id: true },
  });
  if (finishedLottery) {
    await prisma.lotteryWinner.upsert({
      where: { id: `${PREFIX}-lottery-win-finished` },
      update: {
        prizeRank: 2,
        prizeName: "二等奖 · ConnectIQ 限定礼盒",
        notified: true,
      },
      create: {
        id: `${PREFIX}-lottery-win-finished`,
        lotteryId: H.lotteryFinished,
        userId,
        prizeRank: 2,
        prizeName: "二等奖 · ConnectIQ 限定礼盒",
        drawnAt: daysAgo(1, 2),
        notified: true,
      },
    });
    labels.push("历史中奖记录");
  }

  const pollSpecs = [
    {
      pollId: H.pollSingle,
      resId: `${PREFIX}-poll-single`,
      data: { optionId: H.pollSingleOpt1 },
    },
    {
      pollId: H.pollMulti,
      resId: `${PREFIX}-poll-multi-1`,
      data: { optionId: H.pollMultiO1 },
    },
    {
      pollId: H.pollMulti,
      resId: `${PREFIX}-poll-multi-2`,
      data: { optionId: H.pollMultiO2 },
    },
    {
      pollId: H.pollRating,
      resId: `${PREFIX}-poll-rating`,
      data: { rating: 5 },
    },
    {
      pollId: H.pollWordCloud,
      resId: `${PREFIX}-poll-wc`,
      data: { textAnswer: "专业" },
    },
    {
      pollId: H.pollQuiz,
      resId: `${PREFIX}-poll-quiz`,
      data: { optionId: H.pollQuizO2 },
    },
    {
      pollId: H.pollQna,
      resId: `${PREFIX}-poll-qna`,
      data: { textAnswer: "TEST1377 联调：下午主论坛是否有回放？" },
    },
  ] as const;

  let pollCount = 0;
  for (const spec of pollSpecs) {
    const poll = await prisma.poll.findUnique({
      where: { id: spec.pollId },
      select: { id: true },
    });
    if (!poll) continue;

    await prisma.pollResponse.upsert({
      where: { id: spec.resId },
      update: spec.data,
      create: {
        id: spec.resId,
        pollId: spec.pollId,
        participantId,
        ...spec.data,
      },
    });
    pollCount += 1;
  }
  if (pollCount > 0) {
    labels.push(`现场互动(${pollCount} 项: 单选/多选/评分/词云/答题/Q&A)`);
  }

  labels.push(`扫码 Session(${H.sessionCodePoll}/${H.sessionCodeLottery}/T1377L)`);

  return labels;
}

export type MobileTestDimensionsResult = {
  userId: string;
  eventId: string;
  eventName: string;
  joinCode: string;
  dimensions: string[];
};

export async function seedMobileTestAttendeeDimensions(
  userId?: string,
): Promise<MobileTestDimensionsResult> {
  const user =
    userId != null
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true },
        })
      : await prisma.user.findFirst({
          where: { phone: MOBILE_TEST_PHONE },
          select: { id: true, name: true },
        });

  if (!user) {
    throw new Error(`未找到测试用户 ${MOBILE_TEST_PHONE}，请先执行 seedMobileTestAttendee`);
  }

  await ensureSchemaCompat();

  const event = await resolveMobileTestEvent();

  const dimensions: string[] = [];

  const liveLabels = await ensureMobileTestEventLive();
  if (liveLabels.length > 0) {
    dimensions.push(`活动进行中(${liveLabels.join("; ")})`);
  }

  const adminRoleLabels = await ensureMobileTestAdminRoles(user.id, event.id);
  dimensions.push(...adminRoleLabels);

  const eventOrg = await prisma.event.findUnique({
    where: { id: event.id },
    select: { orgId: true },
  });
  await ensurePublicEventPresentation(event.id, eventOrg?.orgId ?? null);
  await ensureEventSpeakers(event.id);
  dimensions.push("公开详情(描述/封面/议程/嘉宾)");

  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId: event.id, key: "join_code" } },
    create: { eventId: event.id, key: "join_code", value: { code: MOBILE_TEST_JOIN_CODE } },
    update: { value: { code: MOBILE_TEST_JOIN_CODE } },
  });
  dimensions.push("活动码");

  const { organizerId } = await ensureHostedExpoMobileFeatures(event.id);
  await ensureSpeedNetworkingFlags([event.id, MOBILE_TEST_PRODUCTION_EVENT_ID]);
  dimensions.push("功能开关(全开·含 SN)");

  const extraBooths = await ensureExtraExpoBooths(event.id);
  if (extraBooths.length > 0) {
    dimensions.push(`扩展展位(+${extraBooths.length})`);
  }

  await ensureLivePollCountdown();
  dimensions.push("现场投票倒计时");

  if (organizerId) {
    await ensureExtraAnnouncements(event.id, organizerId);
    dimensions.push(`现场公告(${EXTRA_ANNOUNCEMENTS.length + 1} 条)`);
  }

  await ensurePeerAvatarsAndIntents(event.id);
  dimensions.push("AI 推荐(6 人+头像)");

  if (organizerId) {
    await ensureStampRallyProgress(event.id, user.id, organizerId);
    dimensions.push(`集章护照(${STAMP_RALLY_STAMPED}/${STAMP_RALLY_TARGET})`);
  }

  const participantId = `seed-part-mobile-test-${MOBILE_TEST_PRIMARY_EVENT_SLUG.replace(/-/g, "_")}`;

  const counterpartyParticipant = await prisma.participant.findFirst({
    where: { eventId: event.id, id: { startsWith: "seed-part-smart-expo" } },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (counterpartyParticipant) {
    await ensureTest1377SnSession(
      event.id,
      participantId,
      counterpartyParticipant.id,
    );
    dimensions.push("SN 速配(进行中·1 轮)");
  }

  if (organizerId) {
    const interactionLabels = await ensureMobileTestInteractions(
      event.id,
      user.id,
      participantId,
      organizerId,
    );
    dimensions.push(...interactionLabels);
  }

  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId: event.id, code: { in: ["A-101", "A-102", "A-103", "A-104", "A-105", "A-106"] } },
    orderBy: { code: "asc" },
    select: { id: true, code: true },
  });

  const [peerA, peerB, peerC] = await Promise.all([
    findPeer("13900000001"),
    findPeer("13900000002"),
    findPeer("13900000003"),
  ]);

  await ensureCommunityPostsSeed(
    event.id,
    user.id,
    [
      peerA ? { id: peerA.id, name: peerA.name, phone: "13900000001" } : null,
      peerB ? { id: peerB.id, name: peerB.name, phone: "13900000002" } : null,
    ].filter(Boolean) as Array<{ id: string; name: string; phone: string }>,
  );
  dimensions.push("社区讨论(3 条)");

  if (peerA) {
    await prisma.businessConnection.upsert({
      where: { id: `${PREFIX}-conn-active` },
      update: { status: ConnectionStatus.ACTIVE, wechatExchanged: true },
      create: {
        id: `${PREFIX}-conn-active`,
        userAId: user.id,
        userBId: peerA.id,
        userAName: MOBILE_TEST_NAME,
        userACompany: "ConnectIQ 测试",
        userBName: peerA.name,
        userBCompany: peerA.profile?.company ?? undefined,
        source: ConnectionSource.SCAN,
        eventId: event.id,
        eventName: event.name,
        aiScore: 86,
        wechatExchanged: true,
        wechatExchangedAt: daysAgo(0, 3),
        fromAiMatch: true,
        aiMatchScore: 86,
      },
    });
    dimensions.push("商务连接(已交换微信)");
  }

  if (peerB) {
    await prisma.exchangeRequest.upsert({
      where: {
        fromUserId_toUserId_eventId: {
          fromUserId: peerB.id,
          toUserId: user.id,
          eventId: event.id,
        },
      },
      update: { status: ExchangeStatus.PENDING, message: "现场认识了一下，方便交换微信吗？" },
      create: {
        id: `${PREFIX}-exchange-in`,
        fromUserId: peerB.id,
        toUserId: user.id,
        eventId: event.id,
        status: ExchangeStatus.PENDING,
        message: "现场认识了一下，方便交换微信吗？",
      },
    });
    dimensions.push("待处理交换请求(收到)");
  }

  if (peerC) {
    await prisma.exchangeRequest.upsert({
      where: {
        fromUserId_toUserId_eventId: {
          fromUserId: user.id,
          toUserId: peerC.id,
          eventId: event.id,
        },
      },
      update: { status: ExchangeStatus.ACCEPTED, message: "想聊聊 CRM 集成合作" },
      create: {
        id: `${PREFIX}-exchange-out`,
        fromUserId: user.id,
        toUserId: peerC.id,
        eventId: event.id,
        status: ExchangeStatus.ACCEPTED,
        message: "想聊聊 CRM 集成合作",
        respondedAt: daysAgo(0, 2),
      },
    });
    dimensions.push("已接受交换请求(发出)");
  }

  const table = await prisma.meetingTable.findUnique({ where: { id: SEED_MTG_TABLE } });
  if (peerA && table) {
    const slot = slotToday(14, 30);
    await prisma.meeting.upsert({
      where: { id: `${PREFIX}-meeting-accepted` },
      update: { status: MeetingStatus.ACCEPTED },
      create: {
        id: `${PREFIX}-meeting-accepted`,
        eventId: event.id,
        requesterId: user.id,
        recipientId: peerA.id,
        status: MeetingStatus.ACCEPTED,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        tableId: table.id,
        message: "想深入聊聊 B2B 营销自动化",
        fromAiMatch: true,
        aiMatchScore: 82,
        respondedAt: daysAgo(0, 1),
      },
    });
    dimensions.push("1v1 会面(已接受)");
  }

  if (peerB) {
    const slot = slotToday(16, 0);
    await prisma.meeting.upsert({
      where: { id: `${PREFIX}-meeting-pending` },
      update: { status: MeetingStatus.PENDING },
      create: {
        id: `${PREFIX}-meeting-pending`,
        eventId: event.id,
        requesterId: peerB.id,
        recipientId: user.id,
        status: MeetingStatus.PENDING,
        scheduledStart: slot.start,
        scheduledEnd: slot.end,
        message: "下午有空聊聊渠道合作吗？",
      },
    });
    dimensions.push("1v1 会面(待确认)");
  }

  if (peerC) {
    await prisma.meeting.upsert({
      where: { id: `${PREFIX}-meeting-done` },
      update: { status: MeetingStatus.COMPLETED, wechatExchanged: true },
      create: {
        id: `${PREFIX}-meeting-done`,
        eventId: event.id,
        requesterId: user.id,
        recipientId: peerC.id,
        status: MeetingStatus.COMPLETED,
        scheduledStart: daysAgo(0, 5),
        scheduledEnd: daysAgo(0, 4),
        wechatExchanged: true,
        respondedAt: daysAgo(0, 5),
      },
    });
    dimensions.push("1v1 会面(已完成)");
  }

  const rally = await prisma.stampRally.findUnique({
    where: { id: stampRallyIdForEvent(event.id) },
    select: { id: true },
  });
  if (rally && booths.length > 0) {
    for (const booth of booths.slice(STAMP_RALLY_STAMPED)) {
      await prisma.boothVisitSignal.createMany({
        data: [
          {
            userId: user.id,
            eventId: event.id,
            signalType: SignalType.BOOTH_SCAN,
            entityId: booth.id,
            entityType: "BOOTH",
            payload: { source: PREFIX, booth_code: booth.code },
          },
        ],
        skipDuplicates: true,
      });
    }
  }

  const boothA101 = booths.find((b) => b.code === "A-101");
  if (boothA101) {
    await prisma.lead.upsert({
      where: { id: `${PREFIX}-lead` },
      update: { intentGrade: "A", notes: "移动端测试账号 · 现场扫码意向 A" },
      create: {
        id: `${PREFIX}-lead`,
        boothId: boothA101.id,
        participantId,
        intentGrade: "A",
        notes: "移动端测试账号 · 现场扫码意向 A",
      },
    });
    dimensions.push("展位线索(A 级)");
  }

  const pointsEntries = [
    { id: `${PREFIX}-pts-checkin`, amount: 100, reason: PointsReason.CHECKIN, note: "活动签到" },
    { id: `${PREFIX}-pts-conn`, amount: 200, reason: PointsReason.CONNECTION, note: "成功交换名片" },
    { id: `${PREFIX}-pts-interact`, amount: 150, reason: PointsReason.INTERACTION, note: "参与现场投票" },
    { id: `${PREFIX}-pts-profile`, amount: 80, reason: PointsReason.PROFILE, note: "完善个人资料" },
    { id: `${PREFIX}-pts-referral`, amount: 250, reason: PointsReason.REFERRAL, note: "成功引荐对接" },
  ];
  for (const row of pointsEntries) {
    await prisma.pointsLedger.upsert({
      where: { id: row.id },
      update: { amount: row.amount },
      create: { id: row.id, userId: user.id, amount: row.amount, reason: row.reason, note: row.note },
    });
  }
  const pointsBalance = pointsEntries.reduce((sum, r) => sum + r.amount, 0);
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    update: { pointsBalance, accountStatus: UserAccountStatus.COMPLETE },
    create: {
      userId: user.id,
      pointsBalance,
      accountStatus: UserAccountStatus.COMPLETE,
      company: "ConnectIQ 测试",
    },
  });
  dimensions.push(`积分(${pointsBalance})`);

  if (peerA && peerB) {
    await prisma.businessReferral.upsert({
      where: { id: `${PREFIX}-referral-sent` },
      update: { status: ReferralStatus.PENDING },
      create: {
        id: `${PREFIX}-referral-sent`,
        introducerId: user.id,
        recipientId: peerA.id,
        userAId: user.id,
        userBId: peerB.id,
        userAName: MOBILE_TEST_NAME,
        userACompany: "ConnectIQ 测试",
        userATitle: "产品经理",
        userBName: peerB.name,
        userBCompany: peerB.profile?.company ?? undefined,
        userBTitle: peerB.profile?.valueProposition ?? undefined,
        status: ReferralStatus.PENDING,
        message: "两位都在做 B2B SaaS，建议现场聊聊",
        aiConfidence: 0.88,
        eventId: event.id,
        eventName: event.name,
      },
    });
    dimensions.push("引荐(我发起)");
  }

  if (peerC) {
    await prisma.businessReferral.upsert({
      where: { id: `${PREFIX}-referral-recv` },
      update: { status: ReferralStatus.ACCEPTED },
      create: {
        id: `${PREFIX}-referral-recv`,
        introducerId: peerC.id,
        recipientId: user.id,
        userAId: peerC.id,
        userBId: user.id,
        userAName: peerC.name,
        userACompany: peerC.profile?.company ?? undefined,
        userBName: MOBILE_TEST_NAME,
        userBCompany: "ConnectIQ 测试",
        userBTitle: "产品经理",
        status: ReferralStatus.ACCEPTED,
        message: "王强推荐你认识，主题很匹配",
        eventId: event.id,
        eventName: event.name,
      },
    });
    dimensions.push("引荐(收到)");
  }

  await prisma.contactCard.upsert({
    where: { userId: user.id },
    update: { wechatId: "qian_test_ci" },
    create: { userId: user.id, wechatId: "qian_test_ci" },
  });
  dimensions.push("联系卡");

  const notifications = [
    {
      id: `${PREFIX}-notif-broadcast`,
      title: "B 厅入口临时调整",
      body: "因人流管控，B 厅入口改至北广场 2 号门，请注意引导标识。",
      read: false,
    },
    {
      id: `${PREFIX}-notif-exchange`,
      title: "李娜 请求与你交换微信",
      body: "李娜 · 云端互动 · 销售总监\n<!--exchange_request:seed-m1377-exchange-in-->",
      read: false,
    },
    {
      id: `${PREFIX}-notif-meeting`,
      title: "会面提醒 · 14:30",
      body: "与张伟的 1v1 会面将在 10 分钟后开始，洽谈区 A 桌 01。\n<!--meeting:seed-m1377-meeting-accepted-->",
      read: false,
    },
    {
      id: `${PREFIX}-notif-lottery`,
      title: "抽奖即将开始",
      body: "16:30 主舞台幸运抽奖，您已自动获得参与资格。\n<!--lottery:seed-m1377-lottery-live-->",
      read: false,
    },
    {
      id: `${PREFIX}-notif-lottery-win`,
      title: "恭喜中奖！",
      body: "您在「昨日预热抽奖」中获得二等奖 · ConnectIQ 限定礼盒，请至服务台领取。\n<!--lottery:seed-int-hosted-lottery-done-->",
      read: false,
    },
    {
      id: `${PREFIX}-notif-ai`,
      title: "AI 为你推荐了 3 位高匹配参会者",
      body: "基于你的意向标签「CRM软件」，建议优先认识张伟与李娜。\n<!--ai_rec:13900000001-->",
      read: true,
    },
  ];
  for (const n of notifications) {
    await prisma.notification.upsert({
      where: { id: n.id },
      update: {
        title: n.title,
        body: n.body,
        readAt: n.read ? daysAgo(0, 1) : null,
      },
      create: {
        id: n.id,
        userId: user.id,
        title: n.title,
        body: n.body,
        readAt: n.read ? daysAgo(0, 1) : null,
      },
    });
  }
  dimensions.push("通知(6 条·5 未读)");

  const feedActor = (
    peer: { id: string; name: string; profile?: { company: string | null } | null },
    phone: string,
    title?: string,
  ) => ({
    id: peer.id,
    name: peer.name,
    avatar_url: avatarSeedUrl(phone),
    company: peer.profile?.company ?? undefined,
    title,
  });

  const feedItems = [
    {
      id: `${PREFIX}-feed-referral`,
      type: FeedItemType.AI_REFERRAL,
      content: JSON.stringify({
        actor_a: peerA ? feedActor(peerA, "13900000001", "CEO") : null,
        actor_b: peerB ? feedActor(peerB, "13900000002", "销售总监") : null,
        is_read: false,
      }),
      aiScore: 92,
      triggerReason: "双方均在寻找 CRM 与营销自动化合作，采购意向高度匹配",
    },
    {
      id: `${PREFIX}-feed-followup`,
      type: FeedItemType.REMINDER,
      content: JSON.stringify({
        actor: peerC ? feedActor(peerC, "13900000003", "市场负责人") : null,
        is_read: false,
      }),
      aiScore: null,
      triggerReason: "上次会面后 7 天未跟进，建议发送一条个性化消息",
      expiresAt: hoursFromNow(48),
    },
    {
      id: `${PREFIX}-feed-contact`,
      type: FeedItemType.INSIGHT,
      content: JSON.stringify({
        actor: peerB ? feedActor(peerB, "13900000002", "销售总监") : null,
        content:
          "李娜刚刚更新了公司动态：正在拓展华东 MarTech 渠道，与你的 SaaS 集成需求高度相关。",
        is_read: true,
      }),
      aiScore: null,
      triggerReason: null,
    },
    {
      id: `${PREFIX}-feed-match`,
      type: FeedItemType.MATCH,
      content: JSON.stringify({
        actor: peerA ? feedActor(peerA, "13900000001", "CEO") : null,
        content: "张伟在意向标签「CRM软件」上与你高度匹配，建议发起连接。",
        is_read: false,
      }),
      aiScore: 86,
      triggerReason: "意向标签重叠 · CRM软件",
    },
  ];
  for (const item of feedItems) {
    await prisma.feedItem.upsert({
      where: { id: item.id },
      update: {
        content: item.content,
        type: item.type,
        aiScore: item.aiScore ?? undefined,
        triggerReason: item.triggerReason ?? undefined,
        expiresAt: item.expiresAt ?? null,
      },
      create: {
        id: item.id,
        userId: user.id,
        eventId: event.id,
        type: item.type,
        content: item.content,
        aiScore: item.aiScore ?? undefined,
        triggerReason: item.triggerReason ?? undefined,
        expiresAt: item.expiresAt ?? null,
      },
    });
  }
  dimensions.push("AI 动态(4 条·引荐/跟进/动态/匹配)");

  const saasEvent = await prisma.event.findUnique({
    where: { slug: "saas-growth-summit-2025" },
    select: { id: true, name: true },
  });
  if (saasEvent && peerA) {
    await prisma.businessConnection.upsert({
      where: { id: `${PREFIX}-conn-summit` },
      update: {},
      create: {
        id: `${PREFIX}-conn-summit`,
        userAId: user.id,
        userBId: peerA.id,
        userAName: MOBILE_TEST_NAME,
        userACompany: "ConnectIQ 测试",
        userBName: peerA.name,
        userBCompany: peerA.profile?.company ?? undefined,
        source: ConnectionSource.SPEED_NETWORKING,
        eventId: saasEvent.id,
        eventName: saasEvent.name,
        aiScore: 79,
      },
    });
    dimensions.push("跨活动连接(SaaS峰会)");
  }

  return {
    userId: user.id,
    eventId: event.id,
    eventName: event.name,
    joinCode: MOBILE_TEST_JOIN_CODE,
    dimensions,
  };
}

async function main() {
  const result = await seedMobileTestAttendeeDimensions();
  console.log(`✓ ${MOBILE_TEST_PHONE} 全维度测试数据`);
  console.log(`  活动: ${result.eventName}`);
  console.log(`  活动码: ${result.joinCode}`);
  console.log(`  维度: ${result.dimensions.join(" · ")}`);
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").includes("seed-mobile-test-dimensions");

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
