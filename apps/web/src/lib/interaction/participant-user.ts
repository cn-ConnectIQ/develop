import { prisma } from "@connectiq/database";

/** 用于 Prisma Participant where：按 User 邮箱/手机号匹配 */
export async function buildParticipantContactOrForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true },
  });
  if (!user) return null;

  const or: Array<{ email?: string; phone?: string }> = [];
  if (user.email) or.push({ email: user.email });
  if (user.phone) or.push({ phone: user.phone });
  return or.length > 0 ? or : null;
}

/** 通过邮箱/手机号将 User 关联到活动 Participant */
export async function findParticipantForUser(
  eventId: string,
  userId: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, name: true },
  });
  if (!user) return null;

  const or: Array<{ email?: string; phone?: string }> = [];
  if (user.email) or.push({ email: user.email });
  if (user.phone) or.push({ phone: user.phone });
  if (or.length === 0) return null;

  return prisma.participant.findFirst({
    where: { eventId, OR: or },
  });
}

/** 确保用户在活动中有 Participant 记录（扫码轻量注册后自动创建） */
export async function ensureParticipantForUser(
  eventId: string,
  userId: string,
) {
  const existing = await findParticipantForUser(eventId, userId);
  if (existing) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) return null;

  return prisma.participant.create({
    data: {
      eventId,
      name: user.name ?? `用户${user.phone?.slice(-4) ?? ""}`,
      email: user.email ?? null,
      phone: user.phone ?? null,
    },
  });
}

export async function hasUserCheckedIn(eventId: string, userId: string) {
  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) return false;

  const checkIn = await prisma.checkIn.findFirst({
    where: { eventId, participantId: participant.id },
    select: { id: true },
  });
  return Boolean(checkIn);
}

export async function hasUserPollParticipation(
  eventId: string,
  userId: string,
  pollId: string,
) {
  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) return false;

  const response = await prisma.pollResponse.findFirst({
    where: { pollId, participantId: participant.id },
    select: { id: true },
  });
  return Boolean(response);
}

/**
 * 是否为本场「正式参会者」（报名/邀请/导入/自助注册），
 * 排除仅因扫码轻量创建、且无报名记录的账号。
 */
export async function isRegisteredAttendee(
  eventId: string,
  userId: string,
): Promise<boolean> {
  const participant = await findParticipantForUser(eventId, userId);
  if (!participant) return false;

  const registration = await prisma.participantRegistration.findFirst({
    where: { participantId: participant.id },
    select: { id: true },
  });
  if (registration) return true;

  if (participant.source !== "SCAN") return true;

  if (
    participant.inviteStatus === "INVITED" ||
    participant.inviteStatus === "CLICKED" ||
    participant.inviteStatus === "ACTIVATED"
  ) {
    return true;
  }

  return false;
}

export type RecentGuestProfile = {
  name: string;
  company: string;
  job_title: string;
  phone: string;
  source_event_id: string | null;
  source_event_name: string | null;
  /** 四项齐全且手机号合法，可直接用于扫码入池 */
  complete: boolean;
};

/**
 * 取用户最近一次参与活动留下的嘉宾资料（姓名/公司/职位/手机），
 * 供小程序扫码表单自动填入；也可在服务端缺 guest_profile 时回填。
 */
export async function resolveRecentGuestProfileForUser(
  userId: string,
  options?: { excludeEventId?: string },
): Promise<RecentGuestProfile | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      phone: true,
      email: true,
      profile: { select: { company: true } },
    },
  });
  if (!user) return null;

  const contactOr: Array<{ email?: string; phone?: string }> = [];
  if (user.email) contactOr.push({ email: user.email });
  if (user.phone) contactOr.push({ phone: user.phone });

  const exclude =
    options?.excludeEventId != null
      ? { eventId: { not: options.excludeEventId } }
      : {};

  const select = {
    name: true,
    company: true,
    jobTitle: true,
    phone: true,
    eventId: true,
    event: { select: { name: true } },
  } as const;

  let recent =
    contactOr.length > 0
      ? await prisma.participant.findFirst({
          where: {
            OR: contactOr,
            ...exclude,
            company: { not: null },
            NOT: { company: "" },
          },
          orderBy: { createdAt: "desc" },
          select,
        })
      : null;

  if (!recent && contactOr.length > 0 && options?.excludeEventId) {
    recent = await prisma.participant.findFirst({
      where: {
        OR: contactOr,
        company: { not: null },
        NOT: { company: "" },
      },
      orderBy: { createdAt: "desc" },
      select,
    });
  }

  if (!recent && contactOr.length > 0) {
    recent = await prisma.participant.findFirst({
      where: { OR: contactOr, ...exclude },
      orderBy: { createdAt: "desc" },
      select,
    });
  }

  if (!recent && contactOr.length > 0 && options?.excludeEventId) {
    recent = await prisma.participant.findFirst({
      where: { OR: contactOr },
      orderBy: { createdAt: "desc" },
      select,
    });
  }

  const name = (recent?.name || user.name || "").trim();
  const company = (recent?.company || user.profile?.company || "").trim();
  const job_title = (recent?.jobTitle || "").trim();
  const phone = (recent?.phone || user.phone || "").trim();

  if (!name && !company && !job_title && !phone) return null;

  return {
    name,
    company,
    job_title,
    phone,
    source_event_id: recent?.eventId ?? null,
    source_event_name: recent?.event?.name ?? null,
    complete:
      Boolean(name && company && job_title) && /^1\d{10}$/.test(phone),
  };
}

/** 用嘉宾资料创建或更新 Participant（扫码入池） */
export async function upsertGuestParticipantForUser(
  eventId: string,
  userId: string,
  profile: {
    name: string;
    company: string;
    jobTitle: string;
    phone: string;
  },
) {
  const existing = await findParticipantForUser(eventId, userId);
  if (existing) {
    return prisma.participant.update({
      where: { id: existing.id },
      data: {
        name: profile.name,
        company: profile.company,
        jobTitle: profile.jobTitle,
        phone: profile.phone,
      },
    });
  }

  return prisma.participant.create({
    data: {
      eventId,
      name: profile.name,
      company: profile.company,
      jobTitle: profile.jobTitle,
      phone: profile.phone,
      source: "SELF_REGISTER",
    },
  });
}
