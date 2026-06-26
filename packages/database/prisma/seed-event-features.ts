/**
 * 活动全功能演示数据：议程 / 参会者 / 问卷 / 工作人员 / SN / 邀请 / 赞助 / 线索 / 集章等
 */
import {
  AiMatchAction,
  AiMatchScenario,
  ConnectionSource,
  ConnectionStatus,
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  InviteStatus,
  LeadStatus,
  MeetingStatus,
  OrgStaffRole,
  ParticipantInviteStatus,
  RegistrationStatus,
  SnSessionStatus,
  StampRallyStatus,
  TicketStatus,
} from "@prisma/client";
import { prisma } from "../src/client";

const FEAT_PREFIX = "seed-feat";

export type SeedEventFeaturesContext = {
  innovationSummitEventId: string;
  saasSummitEventId: string;
  salonEventId: string;
  hostedExpoEventId: string;
  digitalExpoEventId: string;
  unifiedAdminId: string;
  confAdminId: string;
  expoAdminId: string;
  unifiedOrgId: string;
  confOrgId: string;
  expoOrgId: string;
  endUserIds: string[];
  hostedParticipantIds: string[];
  hostedBoothIds: string[];
  digitalBoothC18Id?: string | null;
};

function daysAgo(days: number, hours = 10) {
  return new Date(Date.now() - days * 86_400_000 - hours * 3_600_000);
}

function daysFromNow(days: number, hours = 10) {
  return new Date(Date.now() + days * 86_400_000 + hours * 3_600_000);
}

const ALL_FEAT_IDS = {
  participants: [
    "seed-feat-part-innovation-1",
    "seed-feat-part-innovation-2",
    "seed-feat-part-innovation-3",
    "seed-feat-part-innovation-4",
    "seed-feat-part-innovation-5",
    "seed-feat-part-innovation-6",
    "seed-feat-part-summit-1",
    "seed-feat-part-summit-2",
    "seed-feat-part-summit-3",
    "seed-feat-part-summit-4",
    "seed-feat-part-summit-5",
    "seed-feat-part-summit-6",
    "seed-feat-part-summit-7",
    "seed-feat-part-summit-8",
    "seed-feat-part-salon-1",
    "seed-feat-part-salon-2",
    "seed-feat-part-salon-3",
    "seed-feat-part-salon-4",
  ],
  surveys: [`${FEAT_PREFIX}-survey-innovation`, `${FEAT_PREFIX}-survey-summit`, `${FEAT_PREFIX}-survey-hosted-expo`],
  snSessions: [`${FEAT_PREFIX}-sn-summit`, `${FEAT_PREFIX}-sn-innovation`],
  inviteCampaigns: [`${FEAT_PREFIX}-invite-summit`, `${FEAT_PREFIX}-invite-hosted-expo`],
  stampRallies: [`${FEAT_PREFIX}-stamp-hosted-expo`],
  sponsors: [
    `${FEAT_PREFIX}-sponsor-innovation-1`,
    `${FEAT_PREFIX}-sponsor-innovation-2`,
    `${FEAT_PREFIX}-sponsor-hosted-1`,
    `${FEAT_PREFIX}-sponsor-hosted-2`,
  ],
  meetings: [`${FEAT_PREFIX}-meeting-1`, `${FEAT_PREFIX}-meeting-2`, `${FEAT_PREFIX}-meeting-3`],
  connections: [`${FEAT_PREFIX}-conn-1`, `${FEAT_PREFIX}-conn-2`, `${FEAT_PREFIX}-conn-3`],
  aiMatches: [`${FEAT_PREFIX}-aimatch-1`, `${FEAT_PREFIX}-aimatch-2`, `${FEAT_PREFIX}-aimatch-3`],
  leads: [
    `${FEAT_PREFIX}-lead-a101-1`,
    `${FEAT_PREFIX}-lead-a101-2`,
    `${FEAT_PREFIX}-lead-a102-1`,
    `${FEAT_PREFIX}-lead-a103-1`,
  ],
} as const;

export async function clearSeedEventFeatureData() {
  await prisma.inviteRecord.deleteMany({
    where: { campaignId: { in: [...ALL_FEAT_IDS.inviteCampaigns] } },
  });
  await prisma.inviteCampaign.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.inviteCampaigns] } },
  });
  await prisma.stampRecord.deleteMany({
    where: { rallyId: { in: [...ALL_FEAT_IDS.stampRallies] } },
  });
  await prisma.stampRallyWinner.deleteMany({
    where: { rallyId: { in: [...ALL_FEAT_IDS.stampRallies] } },
  });
  await prisma.stampRally.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.stampRallies] } },
  });
  await prisma.snPair.deleteMany({
    where: { sessionId: { in: [...ALL_FEAT_IDS.snSessions] } },
  });
  await prisma.snSession.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.snSessions] } },
  });
  await prisma.surveyResponse.deleteMany({
    where: { surveyId: { in: [...ALL_FEAT_IDS.surveys] } },
  });
  await prisma.survey.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.surveys] } },
  });
  await prisma.meeting.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.meetings] } },
  });
  await prisma.connectionInteraction.deleteMany({
    where: { connectionId: { in: [...ALL_FEAT_IDS.connections] } },
  });
  await prisma.businessConnection.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.connections] } },
  });
  await prisma.aiMatchResult.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.aiMatches] } },
  });
  await prisma.lead.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.leads] } },
  });
  await prisma.sponsor.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.sponsors] } },
  });
  await prisma.sessionSpeaker.deleteMany({
    where: { sessionId: { startsWith: FEAT_PREFIX } },
  });
  await prisma.speaker.deleteMany({
    where: { id: { startsWith: FEAT_PREFIX } },
  });
  await prisma.session.deleteMany({
    where: { id: { startsWith: FEAT_PREFIX } },
  });
  await prisma.checkIn.deleteMany({
    where: { id: { startsWith: FEAT_PREFIX } },
  });
  await prisma.ticket.deleteMany({
    where: { id: { startsWith: FEAT_PREFIX } },
  });
  await prisma.participantRegistration.deleteMany({
    where: { id: { startsWith: FEAT_PREFIX } },
  });
  await prisma.participant.deleteMany({
    where: { id: { in: [...ALL_FEAT_IDS.participants] } },
  });
}

async function upsertOrgStaff(
  orgId: string,
  userId: string,
  role: OrgStaffRole,
  id: string,
) {
  await prisma.orgStaff.upsert({
    where: { orgId_userId: { orgId, userId } },
    update: { role, status: InviteStatus.ACCEPTED },
    create: {
      id,
      orgId,
      userId,
      role,
      status: InviteStatus.ACCEPTED,
      acceptedAt: daysAgo(30),
    },
  });
}

async function seedOrgStaff(ctx: SeedEventFeaturesContext) {
  const [u5, u6, u7, u8, u9] = ctx.endUserIds;
  if (u5) await upsertOrgStaff(ctx.unifiedOrgId, u5, OrgStaffRole.OPERATOR, `${FEAT_PREFIX}-staff-unified-op`);
  if (u6) await upsertOrgStaff(ctx.unifiedOrgId, u6, OrgStaffRole.ADMIN, `${FEAT_PREFIX}-staff-unified-admin`);
  if (u7) await upsertOrgStaff(ctx.unifiedOrgId, u7, OrgStaffRole.VIEWER, `${FEAT_PREFIX}-staff-unified-viewer`);
  if (u8) await upsertOrgStaff(ctx.confOrgId, u8, OrgStaffRole.OPERATOR, `${FEAT_PREFIX}-staff-conf-op`);
  if (u9) await upsertOrgStaff(ctx.expoOrgId, u9, OrgStaffRole.OPERATOR, `${FEAT_PREFIX}-staff-expo-op`);
}

async function seedBoothOrgStaff(ctx: SeedEventFeaturesContext) {
  const exhibitorOrg = await prisma.organization.findUnique({
    where: { slug: "cloud-crm-tech" },
  });
  const liExhibitorOrg = await prisma.organization.findUnique({
    where: { slug: "cloud-li-exhibitor" },
  });
  const [u0, u1, u2] = ctx.endUserIds;
  if (exhibitorOrg && u0) {
    await upsertOrgStaff(exhibitorOrg.id, u0, OrgStaffRole.OPERATOR, `${FEAT_PREFIX}-staff-booth-crm-op`);
  }
  if (exhibitorOrg && u1) {
    await upsertOrgStaff(exhibitorOrg.id, u1, OrgStaffRole.VIEWER, `${FEAT_PREFIX}-staff-booth-crm-viewer`);
  }
  if (liExhibitorOrg && u2) {
    await upsertOrgStaff(liExhibitorOrg.id, u2, OrgStaffRole.OPERATOR, `${FEAT_PREFIX}-staff-booth-li-op`);
  }
}

type ParticipantSpec = {
  id: string;
  eventId: string;
  name: string;
  company: string;
  jobTitle: string;
  email: string;
  inviteStatus?: ParticipantInviteStatus;
};

async function upsertParticipant(spec: ParticipantSpec) {
  await prisma.participant.upsert({
    where: { id: spec.id },
    update: {
      name: spec.name,
      company: spec.company,
      jobTitle: spec.jobTitle,
      inviteStatus: spec.inviteStatus ?? ParticipantInviteStatus.ACTIVATED,
    },
    create: {
      id: spec.id,
      eventId: spec.eventId,
      name: spec.name,
      company: spec.company,
      jobTitle: spec.jobTitle,
      email: spec.email,
      inviteStatus: spec.inviteStatus ?? ParticipantInviteStatus.ACTIVATED,
    },
  });
}

async function seedParticipants(ctx: SeedEventFeaturesContext) {
  const innovationSpecs: Omit<ParticipantSpec, "eventId">[] = [
    { id: "seed-feat-part-innovation-1", name: "程远", company: "智链科技", jobTitle: "CTO", email: "seed-feat-part-innovation-1@seed.connectiq.local" },
    { id: "seed-feat-part-innovation-2", name: "沈悦", company: "未来会展", jobTitle: "运营总监", email: "seed-feat-part-innovation-2@seed.connectiq.local" },
    { id: "seed-feat-part-innovation-3", name: "高宁", company: "云图数据", jobTitle: "产品VP", email: "seed-feat-part-innovation-3@seed.connectiq.local" },
    { id: "seed-feat-part-innovation-4", name: "叶青", company: "华东制造", jobTitle: "采购总监", email: "seed-feat-part-innovation-4@seed.connectiq.local" },
    { id: "seed-feat-part-innovation-5", name: "方晓", company: "MarTech Lab", jobTitle: "市场负责人", email: "seed-feat-part-innovation-5@seed.connectiq.local" },
    { id: "seed-feat-part-innovation-6", name: "梁晨", company: "企服联盟", jobTitle: "合伙人", email: "seed-feat-part-innovation-6@seed.connectiq.local" },
  ];

  const summitSpecs: Omit<ParticipantSpec, "eventId">[] = [
    { id: "seed-feat-part-summit-1", name: "张伟峰", company: "未来科技", jobTitle: "CEO", email: "seed-feat-part-summit-1@seed.connectiq.local" },
    { id: "seed-feat-part-summit-2", name: "李思琪", company: "云端互动", jobTitle: "销售总监", email: "seed-feat-part-summit-2@seed.connectiq.local" },
    { id: "seed-feat-part-summit-3", name: "王浩然", company: "智联会展", jobTitle: "市场负责人", email: "seed-feat-part-summit-3@seed.connectiq.local" },
    { id: "seed-feat-part-summit-4", name: "陈雨桐", company: "数字营销实验室", jobTitle: "产品经理", email: "seed-feat-part-summit-4@seed.connectiq.local" },
    { id: "seed-feat-part-summit-5", name: "刘子涵", company: "创新工场", jobTitle: "投资经理", email: "seed-feat-part-summit-5@seed.connectiq.local" },
    { id: "seed-feat-part-summit-6", name: "赵一鸣", company: "星河 SaaS", jobTitle: "运营总监", email: "seed-feat-part-summit-6@seed.connectiq.local" },
    { id: "seed-feat-part-summit-7", name: "孙嘉怡", company: "极客营销", jobTitle: "增长负责人", email: "seed-feat-part-summit-7@seed.connectiq.local" },
    { id: "seed-feat-part-summit-8", name: "周子墨", company: "企服优选", jobTitle: "采购经理", email: "seed-feat-part-summit-8@seed.connectiq.local" },
  ];

  const salonSpecs: Omit<ParticipantSpec, "eventId">[] = [
    { id: "seed-feat-part-salon-1", name: "林小北", company: "产品研习社", jobTitle: "创始人", email: "seed-feat-part-salon-1@seed.connectiq.local" },
    { id: "seed-feat-part-salon-2", name: "顾南", company: "增长黑客联盟", jobTitle: "主理人", email: "seed-feat-part-salon-2@seed.connectiq.local" },
    { id: "seed-feat-part-salon-3", name: "韩露", company: "SaaS 观察", jobTitle: "分析师", email: "seed-feat-part-salon-3@seed.connectiq.local", inviteStatus: ParticipantInviteStatus.INVITED },
    { id: "seed-feat-part-salon-4", name: "彭凯", company: "创投圈", jobTitle: "合伙人", email: "seed-feat-part-salon-4@seed.connectiq.local", inviteStatus: ParticipantInviteStatus.CLICKED },
  ];

  for (const s of innovationSpecs) {
    await upsertParticipant({ ...s, eventId: ctx.innovationSummitEventId });
  }
  for (const s of summitSpecs) {
    await upsertParticipant({ ...s, eventId: ctx.saasSummitEventId });
  }
  for (const s of salonSpecs) {
    await upsertParticipant({ ...s, eventId: ctx.salonEventId });
  }

  // 签到 + 票种
  const ticketInnovation = `${FEAT_PREFIX}-ticket-innovation-vip`;
  await prisma.ticketType.upsert({
    where: { id: ticketInnovation },
    update: { name: "嘉宾票", price: 0, quota: 300 },
    create: {
      id: ticketInnovation,
      eventId: ctx.innovationSummitEventId,
      name: "嘉宾票",
      price: 0,
      quota: 300,
    },
  });

  const ticketSummit = `${FEAT_PREFIX}-ticket-summit-vip`;
  await prisma.ticketType.upsert({
    where: { id: ticketSummit },
    update: { name: "VIP 通票", price: 0, quota: 500 },
    create: {
      id: ticketSummit,
      eventId: ctx.saasSummitEventId,
      name: "VIP 通票",
      price: 0,
      quota: 500,
    },
  });

  for (const [i, pid] of innovationSpecs.slice(0, 4).map((s) => s.id).entries()) {
    const regId = `${FEAT_PREFIX}-reg-innovation-${i + 1}`;
    await prisma.participantRegistration.upsert({
      where: { id: regId },
      update: { status: RegistrationStatus.CONFIRMED },
      create: {
        id: regId,
        participantId: pid,
        ticketTypeId: ticketInnovation,
        status: RegistrationStatus.CONFIRMED,
      },
    });
    await prisma.ticket.upsert({
      where: { id: `${FEAT_PREFIX}-ticket-innovation-${i + 1}` },
      update: { status: TicketStatus.ISSUED },
      create: {
        id: `${FEAT_PREFIX}-ticket-innovation-${i + 1}`,
        ticketTypeId: ticketInnovation,
        participantId: pid,
        code: `INNO2025-${String(i + 1).padStart(4, "0")}`,
        status: TicketStatus.ISSUED,
      },
    });
    if (i < 2) {
      await prisma.checkIn.upsert({
        where: { id: `${FEAT_PREFIX}-checkin-innovation-${i + 1}` },
        update: { checkedInAt: daysAgo(0, 1) },
        create: {
          id: `${FEAT_PREFIX}-checkin-innovation-${i + 1}`,
          eventId: ctx.innovationSummitEventId,
          participantId: pid,
          method: "qr",
          checkedInAt: daysAgo(0, 1),
        },
      });
    }
  }

  for (const [i, pid] of summitSpecs.map((s) => s.id).entries()) {
    await prisma.participantRegistration.upsert({
      where: { id: `${FEAT_PREFIX}-reg-summit-${i + 1}` },
      update: { status: RegistrationStatus.CONFIRMED },
      create: {
        id: `${FEAT_PREFIX}-reg-summit-${i + 1}`,
        participantId: pid,
        ticketTypeId: ticketSummit,
        status: RegistrationStatus.CONFIRMED,
      },
    });
    await prisma.ticket.upsert({
      where: { id: `${FEAT_PREFIX}-ticket-summit-${i + 1}` },
      update: { status: i < 6 ? TicketStatus.USED : TicketStatus.ISSUED },
      create: {
        id: `${FEAT_PREFIX}-ticket-summit-${i + 1}`,
        ticketTypeId: ticketSummit,
        participantId: pid,
        code: `SAAS2025-${String(i + 1).padStart(4, "0")}`,
        status: i < 6 ? TicketStatus.USED : TicketStatus.ISSUED,
      },
    });
    if (i < 6) {
      await prisma.checkIn.upsert({
        where: { id: `${FEAT_PREFIX}-checkin-summit-${i + 1}` },
        update: { checkedInAt: daysAgo(0, 3 + i) },
        create: {
          id: `${FEAT_PREFIX}-checkin-summit-${i + 1}`,
          eventId: ctx.saasSummitEventId,
          participantId: pid,
          method: i % 2 === 0 ? "qr" : "manual",
          checkedInAt: daysAgo(0, 3 + i),
        },
      });
    }
  }
}

async function seedAgenda(ctx: SeedEventFeaturesContext) {
  const agendaBlocks = [
    {
      eventId: ctx.innovationSummitEventId,
      sessions: [
        { id: `${FEAT_PREFIX}-session-innovation-1`, title: "开幕 keynote：活动科技新趋势", room: "主会场 A", offsetHours: -2, duration: 1.5 },
        { id: `${FEAT_PREFIX}-session-innovation-2`, title: "圆桌：会议 × 展览融合运营", room: "分会场 B", offsetHours: 1, duration: 1 },
        { id: `${FEAT_PREFIX}-session-innovation-3`, title: "案例分享：ConnectIQ 最佳实践", room: "主会场 A", offsetHours: 3, duration: 1 },
      ],
      speakers: [
        { id: `${FEAT_PREFIX}-speaker-innovation-1`, name: "陈主编", title: "ConnectIQ 创新中心 · 主编", sessionId: `${FEAT_PREFIX}-session-innovation-1` },
        { id: `${FEAT_PREFIX}-speaker-innovation-2`, name: "Dr. Lin", title: "活动科技研究院 · 首席分析师", sessionId: `${FEAT_PREFIX}-session-innovation-1` },
        { id: `${FEAT_PREFIX}-speaker-innovation-3`, name: "程远", title: "智链科技 · CTO", sessionId: `${FEAT_PREFIX}-session-innovation-2` },
        { id: `${FEAT_PREFIX}-speaker-innovation-4`, name: "沈悦", title: "未来会展 · 运营总监", sessionId: `${FEAT_PREFIX}-session-innovation-3` },
      ],
    },
    {
      eventId: ctx.saasSummitEventId,
      sessions: [
        { id: `${FEAT_PREFIX}-session-summit-1`, title: "主题演讲：PLG 增长飞轮", room: "张江厅", offsetHours: -4, duration: 1 },
        { id: `${FEAT_PREFIX}-session-summit-2`, title: "工作坊：AI 赋能 B2B 销售", room: "创新厅", offsetHours: -2, duration: 1.5 },
        { id: `${FEAT_PREFIX}-session-summit-3`, title: "圆桌：从 0 到 1 的客户成功", room: "张江厅", offsetHours: 1, duration: 1 },
      ],
      speakers: [
        { id: `${FEAT_PREFIX}-speaker-summit-1`, name: "李经理", title: "SaaS 增长研究院 · 创始人", sessionId: `${FEAT_PREFIX}-session-summit-1` },
        { id: `${FEAT_PREFIX}-speaker-summit-2`, name: "张伟峰", title: "未来科技 · CEO", sessionId: `${FEAT_PREFIX}-session-summit-2` },
        { id: `${FEAT_PREFIX}-speaker-summit-3`, name: "王浩然", title: "智联会展 · 市场负责人", sessionId: `${FEAT_PREFIX}-session-summit-3` },
      ],
    },
    {
      eventId: ctx.salonEventId,
      sessions: [
        { id: `${FEAT_PREFIX}-session-salon-1`, title: "闭门分享：产品增长实验设计", room: "798 艺术空间", offsetHours: 336, duration: 2 },
      ],
      speakers: [
        { id: `${FEAT_PREFIX}-speaker-salon-1`, name: "林小北", title: "产品研习社 · 创始人", sessionId: `${FEAT_PREFIX}-session-salon-1` },
      ],
    },
  ] as const;

  for (const block of agendaBlocks) {
    for (const s of block.sessions) {
      const start = new Date(Date.now() + s.offsetHours * 3_600_000);
      const end = new Date(start.getTime() + s.duration * 3_600_000);
      await prisma.session.upsert({
        where: { id: s.id },
        update: { title: s.title, room: s.room, startTime: start, endTime: end },
        create: {
          id: s.id,
          eventId: block.eventId,
          title: s.title,
          room: s.room,
          startTime: start,
          endTime: end,
        },
      });
    }
    for (const sp of block.speakers) {
      await prisma.speaker.upsert({
        where: { id: sp.id },
        update: { name: sp.name, title: sp.title },
        create: {
          id: sp.id,
          eventId: block.eventId,
          name: sp.name,
          title: sp.title,
          bio: `${sp.name} 是本场重要嘉宾`,
        },
      });
      await prisma.sessionSpeaker.upsert({
        where: {
          sessionId_speakerId: { sessionId: sp.sessionId, speakerId: sp.id },
        },
        update: {},
        create: { sessionId: sp.sessionId, speakerId: sp.id },
      });
    }
  }
}

const SURVEY_QUESTIONS = [
  { id: "q1", type: "rating", label: "整体满意度（1-5）", required: true },
  { id: "q2", type: "single", label: "您最感兴趣的环节", options: ["主题演讲", "互动体验", "商务洽谈", "展区参观"] },
  { id: "q3", type: "text", label: "改进建议", required: false },
];

async function seedSurveys(ctx: SeedEventFeaturesContext) {
  const specs = [
    {
      id: `${FEAT_PREFIX}-survey-innovation`,
      eventId: ctx.innovationSummitEventId,
      title: "创新峰会会后满意度问卷",
      participantIds: ["seed-feat-part-innovation-1", "seed-feat-part-innovation-2", "seed-feat-part-innovation-3"],
    },
    {
      id: `${FEAT_PREFIX}-survey-summit`,
      eventId: ctx.saasSummitEventId,
      title: "SaaS 增长峰会反馈问卷",
      participantIds: ["seed-feat-part-summit-1", "seed-feat-part-summit-2", "seed-feat-part-summit-3", "seed-feat-part-summit-4"],
    },
    {
      id: `${FEAT_PREFIX}-survey-hosted-expo`,
      eventId: ctx.hostedExpoEventId,
      title: "智链博览会观众体验问卷",
      participantIds: ctx.hostedParticipantIds.slice(0, 3),
    },
  ];

  for (const spec of specs) {
    await prisma.survey.upsert({
      where: { id: spec.id },
      update: { title: spec.title, questions: SURVEY_QUESTIONS },
      create: {
        id: spec.id,
        eventId: spec.eventId,
        title: spec.title,
        questions: SURVEY_QUESTIONS,
      },
    });

    for (const [i, pid] of spec.participantIds.entries()) {
      if (!pid) continue;
      await prisma.surveyResponse.upsert({
        where: { id: `${spec.id}-res-${i + 1}` },
        update: {},
        create: {
          id: `${spec.id}-res-${i + 1}`,
          surveyId: spec.id,
          participantId: pid,
          answers: {
            q1: 4 + (i % 2),
            q2: ["主题演讲", "互动体验", "商务洽谈", "展区参观"][i % 4],
            q3: i === 0 ? "希望增加更多互动环节" : "整体体验很好",
          },
        },
      });
    }
  }
}

async function seedSpeedNetworking(ctx: SeedEventFeaturesContext) {
  const summitSessionId = `${FEAT_PREFIX}-sn-summit`;
  await prisma.snSession.upsert({
    where: { id: summitSessionId },
    update: { status: SnSessionStatus.IN_PROGRESS, roundCount: 3 },
    create: {
      id: summitSessionId,
      eventId: ctx.saasSummitEventId,
      status: SnSessionStatus.IN_PROGRESS,
      roundCount: 3,
      startedAt: daysAgo(0, 5),
    },
  });

  const pairs = [
    ["seed-feat-part-summit-1", "seed-feat-part-summit-2"],
    ["seed-feat-part-summit-3", "seed-feat-part-summit-4"],
    ["seed-feat-part-summit-5", "seed-feat-part-summit-6"],
    ["seed-feat-part-summit-7", "seed-feat-part-summit-8"],
  ] as const;

  for (const [i, [a, b]] of pairs.entries()) {
    await prisma.snPair.upsert({
      where: { id: `${FEAT_PREFIX}-sn-pair-summit-${i + 1}` },
      update: {
        ratingA: 4 + (i % 2),
        ratingB: 5 - (i % 2),
        connectionEstablished: i < 2,
      },
      create: {
        id: `${FEAT_PREFIX}-sn-pair-summit-${i + 1}`,
        sessionId: summitSessionId,
        participantAId: a,
        participantBId: b,
        round: (i % 3) + 1,
        ratingA: 4 + (i % 2),
        ratingB: 5 - (i % 2),
        connectionEstablished: i < 2,
      },
    });
  }

  await prisma.snSession.upsert({
    where: { id: `${FEAT_PREFIX}-sn-innovation` },
    update: { status: SnSessionStatus.SCHEDULED },
    create: {
      id: `${FEAT_PREFIX}-sn-innovation`,
      eventId: ctx.innovationSummitEventId,
      status: SnSessionStatus.SCHEDULED,
      roundCount: 2,
    },
  });
}

async function seedInviteCampaigns(ctx: SeedEventFeaturesContext) {
  const summitCampaignId = `${FEAT_PREFIX}-invite-summit`;
  await prisma.inviteCampaign.upsert({
    where: { id: summitCampaignId },
    update: {
      status: InviteCampaignStatus.SENT,
      sentCount: 4,
      deliveredCount: 4,
      clickedCount: 2,
      activatedCount: 2,
    },
    create: {
      id: summitCampaignId,
      eventId: ctx.saasSummitEventId,
      createdBy: ctx.confAdminId,
      name: "峰会开幕短信邀请",
      channel: InviteChannel.SMS,
      status: InviteCampaignStatus.SENT,
      subject: "SaaS 增长峰会 2025 开幕提醒",
      customMessage: "您好，SaaS 增长峰会今日开幕，请凭电子票入场。",
      totalTarget: 8,
      sentCount: 4,
      deliveredCount: 4,
      clickedCount: 2,
      activatedCount: 2,
      startedAt: daysAgo(1),
      completedAt: daysAgo(0, 20),
    },
  });

  const summitParticipants = [
    "seed-feat-part-summit-1",
    "seed-feat-part-summit-2",
    "seed-feat-part-summit-3",
    "seed-feat-part-summit-4",
  ];
  const statuses: InviteRecordStatus[] = [
    InviteRecordStatus.ACTIVATED,
    InviteRecordStatus.ACTIVATED,
    InviteRecordStatus.CLICKED,
    InviteRecordStatus.DELIVERED,
  ];

  for (const [i, pid] of summitParticipants.entries()) {
    await prisma.inviteRecord.upsert({
      where: { campaignId_participantId: { campaignId: summitCampaignId, participantId: pid } },
      update: { status: statuses[i] },
      create: {
        id: `${FEAT_PREFIX}-invite-rec-summit-${i + 1}`,
        campaignId: summitCampaignId,
        participantId: pid,
        userId: ctx.endUserIds[i] ?? null,
        channel: InviteChannel.SMS,
        destination: `1380013800${i}`,
        tokenExpiresAt: daysFromNow(7),
        status: statuses[i],
        sentAt: daysAgo(1),
        deliveredAt: daysAgo(1),
        clickedAt: i < 2 ? daysAgo(0, 18) : null,
        activatedAt: i < 2 ? daysAgo(0, 16) : null,
      },
    });
  }

  const expoCampaignId = `${FEAT_PREFIX}-invite-hosted-expo`;
  await prisma.inviteCampaign.upsert({
    where: { id: expoCampaignId },
    update: { status: InviteCampaignStatus.SCHEDULED },
    create: {
      id: expoCampaignId,
      eventId: ctx.hostedExpoEventId,
      createdBy: ctx.unifiedAdminId,
      name: "智链博览会 VIP 观众邀请",
      channel: InviteChannel.EMAIL,
      status: InviteCampaignStatus.SCHEDULED,
      subject: "智链未来产业博览会 2026 — VIP 邀请",
      customMessage: "诚邀您莅临智链未来产业博览会，体验智能制造与企业服务展区。",
      totalTarget: 5,
      scheduledAt: daysFromNow(3),
    },
  });
}

async function seedSponsors(ctx: SeedEventFeaturesContext) {
  const items = [
    { id: `${FEAT_PREFIX}-sponsor-innovation-1`, eventId: ctx.innovationSummitEventId, name: "ConnectIQ", level: "钻石赞助" },
    { id: `${FEAT_PREFIX}-sponsor-innovation-2`, eventId: ctx.innovationSummitEventId, name: "智链产业基金", level: "金牌赞助" },
    { id: `${FEAT_PREFIX}-sponsor-hosted-1`, eventId: ctx.hostedExpoEventId, name: "华为云", level: "战略伙伴" },
    { id: `${FEAT_PREFIX}-sponsor-hosted-2`, eventId: ctx.hostedExpoEventId, name: "阿里云", level: "钻石展商" },
  ];
  for (const s of items) {
    await prisma.sponsor.upsert({
      where: { id: s.id },
      update: { name: s.name, level: s.level },
      create: { id: s.id, eventId: s.eventId, name: s.name, level: s.level },
    });
  }
}

async function seedHostedExpoExtras(ctx: SeedEventFeaturesContext) {
  if (ctx.hostedBoothIds.length >= 3 && ctx.hostedParticipantIds.length >= 3) {
    const leadSpecs = [
      { id: `${FEAT_PREFIX}-lead-a101-1`, boothIdx: 0, partIdx: 0, status: LeadStatus.NEW, grade: "A" },
      { id: `${FEAT_PREFIX}-lead-a101-2`, boothIdx: 0, partIdx: 1, status: LeadStatus.CONTACTED, grade: "B" },
      { id: `${FEAT_PREFIX}-lead-a102-1`, boothIdx: 1, partIdx: 2, status: LeadStatus.QUALIFIED, grade: "A" },
      { id: `${FEAT_PREFIX}-lead-a103-1`, boothIdx: 2, partIdx: 3, status: LeadStatus.NEW, grade: "C" },
    ];
    for (const l of leadSpecs) {
      const boothId = ctx.hostedBoothIds[l.boothIdx];
      const participantId = ctx.hostedParticipantIds[l.partIdx];
      if (!boothId || !participantId) continue;
      await prisma.lead.upsert({
        where: { id: l.id },
        update: { status: l.status, intentGrade: l.grade },
        create: {
          id: l.id,
          boothId,
          participantId,
          status: l.status,
          intentGrade: l.grade,
          notes: "Seed 展位线索 — 现场扫码采集",
        },
      });
    }
  }

  if (ctx.hostedBoothIds.length > 0) {
    await prisma.stampRally.upsert({
      where: { id: `${FEAT_PREFIX}-stamp-hosted-expo` },
      update: {
        status: StampRallyStatus.ACTIVE,
        boothIds: ctx.hostedBoothIds,
        totalBooths: ctx.hostedBoothIds.length,
      },
      create: {
        id: `${FEAT_PREFIX}-stamp-hosted-expo`,
        eventId: ctx.hostedExpoEventId,
        createdById: ctx.unifiedAdminId,
        name: "智链博览会集章之旅",
        description: "逛遍三大精品展位，集章兑换 ConnectIQ 周边",
        prize: "ConnectIQ 限定礼盒",
        requiredCount: 2,
        totalBooths: ctx.hostedBoothIds.length,
        boothIds: ctx.hostedBoothIds,
        status: StampRallyStatus.ACTIVE,
      },
    });

    const stampUser = ctx.endUserIds[0];
    if (stampUser && ctx.hostedBoothIds[0] && ctx.hostedBoothIds[1]) {
      for (const [i, boothId] of ctx.hostedBoothIds.slice(0, 2).entries()) {
        await prisma.stampRecord.upsert({
          where: {
            rallyId_userId_boothId: {
              rallyId: `${FEAT_PREFIX}-stamp-hosted-expo`,
              userId: stampUser,
              boothId,
            },
          },
          update: {},
          create: {
            id: `${FEAT_PREFIX}-stamp-rec-${i + 1}`,
            rallyId: `${FEAT_PREFIX}-stamp-hosted-expo`,
            userId: stampUser,
            boothId,
          },
        });
      }
    }
  }

  // 展会配置（展商/买家报名、匹配、通知）
  const expoSettings = [
    {
      key: "expo_registration",
      value: { enabled: true, deadline: daysFromNow(10).toISOString().slice(0, 10), require_company: true, notes: "展位申请需提交公司资质" },
    },
    {
      key: "expo_buyer",
      value: { enabled: true, hosted_buyer_quota: 80, qualification: "年采购预算 50 万以上" },
    },
    {
      key: "expo_matching",
      value: { enabled: true, min_score: 65, auto_notify: true },
    },
    {
      key: "expo_notifications",
      value: { checkin_reminder: true, matching_digest: true, custom_message: "欢迎莅临智链未来产业博览会！" },
    },
  ];

  for (const s of expoSettings) {
    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId: ctx.hostedExpoEventId, key: s.key } },
      create: { eventId: ctx.hostedExpoEventId, key: s.key, value: s.value },
      update: { value: s.value },
    });
  }
}

async function seedNetworking(ctx: SeedEventFeaturesContext) {
  const [u0, u1, u2, u3] = ctx.endUserIds;
  if (u0 && u1) {
    await prisma.businessConnection.upsert({
      where: { id: `${FEAT_PREFIX}-conn-1` },
      update: { status: ConnectionStatus.ACTIVE },
      create: {
        id: `${FEAT_PREFIX}-conn-1`,
        userAId: u0,
        userBId: u1,
        userAName: "张伟",
        userACompany: "未来科技",
        userBName: "李娜",
        userBCompany: "云端互动",
        source: ConnectionSource.SPEED_NETWORKING,
        eventId: ctx.saasSummitEventId,
        eventName: "SaaS 增长峰会 2025",
        aiScore: 88,
        wechatExchanged: true,
        wechatExchangedAt: daysAgo(0, 4),
      },
    });
    await prisma.connectionInteraction.createMany({
      data: [
        {
          id: `${FEAT_PREFIX}-conn-int-1`,
          connectionId: `${FEAT_PREFIX}-conn-1`,
          type: "meeting",
          description: "Speed Networking 配对后线下交流 15 分钟",
        },
      ],
      skipDuplicates: true,
    });
  }

  if (u2 && u3) {
    await prisma.businessConnection.upsert({
      where: { id: `${FEAT_PREFIX}-conn-2` },
      update: {},
      create: {
        id: `${FEAT_PREFIX}-conn-2`,
        userAId: u2,
        userBId: u3,
        userAName: "王强",
        userACompany: "智联会展",
        userBName: "陈静",
        userBCompany: "数字营销实验室",
        source: ConnectionSource.SCAN,
        eventId: ctx.hostedExpoEventId,
        aiScore: 72,
      },
    });
  }

  if (u0 && u2) {
    await prisma.meeting.upsert({
      where: { id: `${FEAT_PREFIX}-meeting-1` },
      update: { status: MeetingStatus.ACCEPTED },
      create: {
        id: `${FEAT_PREFIX}-meeting-1`,
        eventId: ctx.saasSummitEventId,
        requesterId: u0,
        recipientId: u2,
        status: MeetingStatus.ACCEPTED,
        scheduledStart: daysFromNow(0, 2),
        scheduledEnd: daysFromNow(0, 3),
        respondedAt: new Date(),
      },
    });
  }

  if (u1 && u3) {
    await prisma.meeting.upsert({
      where: { id: `${FEAT_PREFIX}-meeting-2` },
      update: { status: MeetingStatus.COMPLETED, wechatExchanged: true },
      create: {
        id: `${FEAT_PREFIX}-meeting-2`,
        eventId: ctx.hostedExpoEventId,
        requesterId: u1,
        recipientId: u3,
        status: MeetingStatus.COMPLETED,
        scheduledStart: daysAgo(0, 6),
        scheduledEnd: daysAgo(0, 5),
        wechatExchanged: true,
        respondedAt: daysAgo(0, 6),
      },
    });
  }

  if (u0 && u3) {
    await prisma.meeting.upsert({
      where: { id: `${FEAT_PREFIX}-meeting-3` },
      update: { status: MeetingStatus.PENDING },
      create: {
        id: `${FEAT_PREFIX}-meeting-3`,
        eventId: ctx.innovationSummitEventId,
        requesterId: u0,
        recipientId: u3,
        status: MeetingStatus.PENDING,
        scheduledStart: daysFromNow(20, 14),
        scheduledEnd: daysFromNow(20, 15),
        message: "想聊聊活动数字化合作机会",
      },
    });
  }

  const aiSpecs = [
    {
      id: `${FEAT_PREFIX}-aimatch-1`,
      eventId: ctx.hostedExpoEventId,
      userAName: "林峰",
      userACompany: "智造科技",
      userBName: "云端 CRM",
      userBCompany: "A-101 展位",
      score: 91,
      reason: "你寻找 ERP 方案 ↔ TA 提供 ERP",
      matchReason: [
        { type: "demand_supply", label: "你寻找 ERP 方案 ↔ TA 提供 ERP", detail: "ERP" },
        { type: "shared_topic", label: "你们都关注 智能制造", detail: "智能制造" },
      ],
      scenario: AiMatchScenario.BUYER_TO_EXHIBITOR,
      action: AiMatchAction.VIEWED,
    },
    {
      id: `${FEAT_PREFIX}-aimatch-2`,
      eventId: ctx.digitalExpoEventId,
      userAName: "马晨",
      userACompany: "华东智造",
      userBName: "ConnectIQ",
      userBCompany: "C-18 展台",
      score: 85,
      reason: "你寻找 数字化方案 ↔ TA 提供 活动科技",
      matchReason: [
        { type: "demand_supply", label: "你寻找 数字化方案 ↔ TA 提供 活动科技" },
        { type: "industry", label: "跨公司参会，存在商务合作空间" },
      ],
      scenario: AiMatchScenario.EXHIBITOR_TO_BUYER,
      action: AiMatchAction.CONTACTED,
      connected: true,
    },
    {
      id: `${FEAT_PREFIX}-aimatch-3`,
      eventId: ctx.saasSummitEventId,
      userAName: "张伟峰",
      userACompany: "未来科技",
      userBName: "李思琪",
      userBCompany: "云端互动",
      score: 78,
      reason: "你们都关注 AI 落地",
      matchReason: [
        { type: "shared_topic", label: "你们都关注 AI 落地", detail: "AI 落地" },
        { type: "supply_demand", label: "TA 寻找 增长方法论 ↔ 你提供 增长方法论" },
      ],
      scenario: AiMatchScenario.PARTICIPANT_PEER,
      action: AiMatchAction.MEETING_BOOKED,
    },
  ];

  for (const m of aiSpecs) {
    await prisma.aiMatchResult.upsert({
      where: { id: m.id },
      update: {
        score: m.score,
        action: m.action,
        connected: m.connected ?? false,
        reason: m.reason,
        matchReason: m.matchReason,
      },
      create: {
        id: m.id,
        eventId: m.eventId,
        userAName: m.userAName,
        userACompany: m.userACompany,
        userBName: m.userBName,
        userBCompany: m.userBCompany,
        score: m.score,
        reason: m.reason,
        matchReason: m.matchReason,
        scenario: m.scenario,
        action: m.action,
        connected: m.connected ?? false,
      },
    });
  }
}

export async function seedEventFeatureDemoData(ctx: SeedEventFeaturesContext) {
  await clearSeedEventFeatureData();
  await seedOrgStaff(ctx);
  await seedBoothOrgStaff(ctx);
  await seedParticipants(ctx);
  await seedAgenda(ctx);
  await seedSurveys(ctx);
  await seedSpeedNetworking(ctx);
  await seedInviteCampaigns(ctx);
  await seedSponsors(ctx);
  await seedHostedExpoExtras(ctx);
  await seedNetworking(ctx);

  return {
    innovationParticipantIds: ALL_FEAT_IDS.participants.filter((id) =>
      id.includes("innovation"),
    ),
    summitParticipantIds: ALL_FEAT_IDS.participants.filter((id) =>
      id.includes("summit"),
    ),
    salonParticipantIds: ALL_FEAT_IDS.participants.filter((id) =>
      id.includes("salon"),
    ),
  };
}
