import {
  InviteStatus,
  OrgStaffRole,
  ParticipantSource,
  SystemRole,
  prisma,
  type ExhibitorBooth,
  type Participant,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { resolveMobileExhibitorBoothAccess } from "@/lib/mobile-exhibitor-service";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import { generateBadgeQr } from "@/lib/participants";
import { resolveUserIdForParticipant } from "@/lib/participant-notify-service";
import { maybeAutoInviteBoothStaff } from "@/lib/invite/send-fixed-invites";
import { sendExhibitorInviteSubscribe } from "@/lib/wechat/subscribe-message";

export type BoothStaffMemberView = {
  id: string;
  name: string;
  avatar: string | null;
  phone: string | null;
  isBoothOwner: boolean;
  joinedAt: string;
};

export type BoothStaffListPayload = {
  members: BoothStaffMemberView[];
  maxCount: number;
  currentCount: number;
  remainingSlots: number;
  /** 当前登录用户是否为展位主账号（供移动端权限 UI） */
  viewerIsOwner?: boolean;
};

type BoothStaffContext = {
  userId: string;
  booth: Pick<
    ExhibitorBooth,
    | "id"
    | "eventId"
    | "name"
    | "maxStaffCount"
    | "extraStaffPurchased"
    | "operatorUserId"
    | "companyOrgId"
  >;
  viewerParticipant: Participant | null;
};

type BoothOperatorBooth = Pick<
  ExhibitorBooth,
  "id" | "operatorUserId" | "companyOrgId"
>;

function normalizePhone(phone: string): string {
  return phone.trim();
}

function isValidCnPhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

function resolveAvatarUrl(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.slice(0, 1) || "?")}`;
}

export function resolveBoothStaffMaxCount(
  booth: Pick<ExhibitorBooth, "maxStaffCount" | "extraStaffPurchased">,
): number {
  return booth.maxStaffCount + booth.extraStaffPurchased;
}

/** 活动内各展位当前 EXHIBITOR 工作人员数（含主账号） */
export async function countBoothStaffByEvent(
  eventId: string,
): Promise<Map<string, number>> {
  const rows = await prisma.participant.groupBy({
    by: ["boothId"],
    where: {
      eventId,
      boothId: { not: null },
      systemRole: SystemRole.EXHIBITOR,
    },
    _count: { _all: true },
  });

  const map = new Map<string, number>();
  for (const row of rows) {
    if (row.boothId) map.set(row.boothId, row._count._all);
  }
  return map;
}

export function formatStaffQuotaLabel(current: number, max: number): string {
  if (max > 0 && current >= max) return `${current}/${max} 已满`;
  return `${current}/${max}`;
}

async function loadBoothOrThrow(boothId: string) {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      eventId: true,
      name: true,
      maxStaffCount: true,
      extraStaffPurchased: true,
      operatorUserId: true,
      companyOrgId: true,
      event: { select: { name: true } },
    },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }
  return booth;
}

/** 当前 User 在该展位的 EXHIBITOR Participant（主账号或团队成员） */
export async function findBoothExhibitorParticipantForUser(
  eventId: string,
  boothId: string,
  userId: string,
): Promise<Participant | null> {
  const linked = await findParticipantForUser(eventId, userId);
  if (!linked) return null;
  if (
    linked.systemRole !== SystemRole.EXHIBITOR ||
    linked.boothId !== boothId
  ) {
    return null;
  }
  return linked;
}

/** 展位操作员：operatorUserId / 组织 owner / 已接受 OrgStaff OWNER|ADMIN */
async function isUserBoothOperator(
  userId: string,
  booth: BoothOperatorBooth,
): Promise<boolean> {
  if (booth.operatorUserId === userId) return true;

  const orgAccess = await prisma.organization.findFirst({
    where: {
      id: booth.companyOrgId,
      OR: [
        { ownerId: userId },
        {
          staff: {
            some: {
              userId,
              status: InviteStatus.ACCEPTED,
              role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return Boolean(orgAccess);
}

/** 将展位操作员同步为 is_booth_owner 的 Participant（兼容历史数据） */
async function ensureBoothOwnerParticipant(
  eventId: string,
  boothId: string,
  userId: string,
): Promise<Participant | null> {
  const existing = await findBoothExhibitorParticipantForUser(
    eventId,
    boothId,
    userId,
  );
  if (existing?.isBoothOwner) return existing;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, phone: true, name: true },
  });
  if (!user) return null;

  const linked = await findParticipantForUser(eventId, userId);
  if (linked) {
    if (
      linked.systemRole === SystemRole.EXHIBITOR &&
      linked.boothId &&
      linked.boothId !== boothId
    ) {
      return null;
    }
    return prisma.participant.update({
      where: { id: linked.id },
      data: {
        systemRole: SystemRole.EXHIBITOR,
        boothId,
        isBoothOwner: true,
        name: linked.name || user.name || "展位主账号",
      },
    });
  }

  const created = await prisma.participant.create({
    data: {
      eventId,
      name: user.name ?? `用户${user.phone?.slice(-4) ?? ""}`,
      email: user.email ?? null,
      phone: user.phone ?? null,
      systemRole: SystemRole.EXHIBITOR,
      boothId,
      isBoothOwner: true,
      badgeQr: generateBadgeQr(eventId),
    },
  });

  void maybeAutoInviteBoothStaff({
    eventId,
    participantIds: [created.id],
    createdBy: userId,
  }).catch((err) => {
    console.error("[booth-owner] auto-invite failed", err);
  });

  return created;
}

async function countBoothStaff(boothId: string): Promise<number> {
  return prisma.participant.count({
    where: {
      boothId,
      systemRole: SystemRole.EXHIBITOR,
    },
  });
}

function serializeMember(row: Participant): BoothStaffMemberView {
  return {
    id: row.id,
    name: row.name,
    avatar: resolveAvatarUrl(row.name),
    phone: row.phone,
    isBoothOwner: row.isBoothOwner,
    joinedAt: row.createdAt.toISOString(),
  };
}

/** GET：展位 EXHIBITOR 成员可查看；兼容 B 端组织展位权限（便于 Web 控制台） */
export async function requireBoothStaffViewer(
  request: Request,
  boothId: string,
): Promise<BoothStaffContext> {
  const booth = await loadBoothOrThrow(boothId);
  const userId = await resolveMobileUserId(request);

  const linked = await findBoothExhibitorParticipantForUser(
    booth.eventId,
    boothId,
    userId,
  );
  if (linked) {
    return { userId, booth, viewerParticipant: linked };
  }

  if (await isUserBoothOperator(userId, booth)) {
    const ownerParticipant = await ensureBoothOwnerParticipant(
      booth.eventId,
      boothId,
      userId,
    );
    return { userId, booth, viewerParticipant: ownerParticipant };
  }

  try {
    await resolveMobileExhibitorBoothAccess(request, boothId);
    return { userId, booth, viewerParticipant: null };
  } catch {
    throw new ApiError("无权查看展位团队成员", ErrorCode.FORBIDDEN, 403);
  }
}

/** POST/DELETE：仅 is_booth_owner=true 的主账号 */
export async function requireBoothStaffOwner(
  request: Request,
  boothId: string,
): Promise<BoothStaffContext & { ownerParticipant: Participant }> {
  const booth = await loadBoothOrThrow(boothId);
  const userId = await resolveMobileUserId(request);

  let ownerParticipant = await findBoothExhibitorParticipantForUser(
    booth.eventId,
    boothId,
    userId,
  );

  if (ownerParticipant && !ownerParticipant.isBoothOwner) {
    throw new ApiError("仅展位主账号可管理团队成员", ErrorCode.FORBIDDEN, 403);
  }

  if (!ownerParticipant?.isBoothOwner && (await isUserBoothOperator(userId, booth))) {
    ownerParticipant = await ensureBoothOwnerParticipant(
      booth.eventId,
      boothId,
      userId,
    );
  }

  if (!ownerParticipant?.isBoothOwner) {
    throw new ApiError("仅展位主账号可管理团队成员", ErrorCode.FORBIDDEN, 403);
  }

  return {
    userId,
    booth,
    viewerParticipant: ownerParticipant,
    ownerParticipant,
  };
}

export async function listBoothStaffMembers(
  boothId: string,
): Promise<BoothStaffListPayload> {
  const booth = await loadBoothOrThrow(boothId);
  const maxCount = resolveBoothStaffMaxCount(booth);

  const rows = await prisma.participant.findMany({
    where: {
      boothId,
      systemRole: SystemRole.EXHIBITOR,
    },
    orderBy: [{ isBoothOwner: "desc" }, { createdAt: "asc" }],
  });

  const currentCount = rows.length;

  return {
    members: rows.map((row) => serializeMember(row)),
    maxCount,
    currentCount,
    remainingSlots: Math.max(0, maxCount - currentCount),
  };
}

async function findOrCreateUserByPhone(phone: string, name: string) {
  const existing = await prisma.user.findFirst({
    where: { phone },
    select: { id: true, name: true },
  });
  if (existing) return existing;

  const email = `booth_staff_${phone}@mini.connectiq.local`;
  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const finalEmail = taken ? `booth_staff_${phone}_${Date.now()}@mini.connectiq.local` : email;

  return prisma.user.create({
    data: {
      email: finalEmail,
      passwordHash: "mini_program",
      name: name.trim() || `用户${phone.slice(-4)}`,
      phone,
    },
    select: { id: true, name: true },
  });
}

async function notifyStaffAdded(input: {
  participant: Participant;
  boothName: string;
  eventName: string;
  boothId: string;
  inviterName: string;
}) {
  const userId = await resolveUserIdForParticipant({
    phone: input.participant.phone,
    email: input.participant.email,
  });
  if (!userId) return;

  await prisma.notification.create({
    data: {
      userId,
      title: "展位团队邀请",
      body: `${input.inviterName} 已将你添加为「${input.boothName}」团队成员（${input.eventName}）`,
    },
  });

  void sendExhibitorInviteSubscribe({
    toUserId: userId,
    exhibitorName: input.boothName,
    eventName: input.eventName,
    boothId: input.boothId,
  });
}

export async function addBoothStaffMember(
  boothId: string,
  input: { phone: string; name?: string },
  inviterUserId: string,
): Promise<{ member: BoothStaffMemberView }> {
  const phone = normalizePhone(input.phone);
  if (!isValidCnPhone(phone)) {
    throw new ApiError("请输入有效的中国大陆手机号", ErrorCode.VALIDATION_ERROR, 400);
  }

  const booth = await loadBoothOrThrow(boothId);
  const maxCount = resolveBoothStaffMaxCount(booth);
  const currentCount = await countBoothStaff(boothId);

  if (currentCount >= maxCount) {
    throw new ApiError(
      `工作人员名额已满(${currentCount}/${maxCount})，如需更多名额请联系主办方`,
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const existingOnBooth = await prisma.participant.findFirst({
    where: { eventId: booth.eventId, boothId, phone },
  });
  if (existingOnBooth) {
    throw new ApiError("该成员已在展位团队中", ErrorCode.VALIDATION_ERROR, 409);
  }

  const existingOnEvent = await prisma.participant.findFirst({
    where: { eventId: booth.eventId, phone },
  });

  if (
    existingOnEvent &&
    existingOnEvent.systemRole === SystemRole.EXHIBITOR &&
    existingOnEvent.boothId &&
    existingOnEvent.boothId !== boothId
  ) {
    throw new ApiError("该手机号已是其他展位的团队成员", ErrorCode.VALIDATION_ERROR, 409);
  }

  const displayName =
    input.name?.trim() ||
    existingOnEvent?.name ||
    `用户${phone.slice(-4)}`;

  await findOrCreateUserByPhone(phone, displayName);

  let participant: Participant;

  if (existingOnEvent) {
    if (existingOnEvent.isBoothOwner) {
      throw new ApiError("无法将展位主账号添加为团队成员", ErrorCode.VALIDATION_ERROR, 400);
    }
    participant = await prisma.participant.update({
      where: { id: existingOnEvent.id },
      data: {
        name: displayName,
        systemRole: SystemRole.EXHIBITOR,
        boothId,
        isBoothOwner: false,
      },
    });
  } else {
    participant = await prisma.participant.create({
      data: {
        eventId: booth.eventId,
        name: displayName,
        phone,
        systemRole: SystemRole.EXHIBITOR,
        boothId,
        isBoothOwner: false,
        source: ParticipantSource.INVITE,
        badgeQr: generateBadgeQr(booth.eventId),
      },
    });
  }

  const inviter = await prisma.user.findUnique({
    where: { id: inviterUserId },
    select: { name: true },
  });

  void notifyStaffAdded({
    participant,
    boothName: booth.name,
    eventName: booth.event.name,
    boothId,
    inviterName: inviter?.name ?? "展位主账号",
  });

  // 展商工作人员已是大会参会者；开启配置后自动发固定模板短信/邮件邀请
  void maybeAutoInviteBoothStaff({
    eventId: booth.eventId,
    participantIds: [participant.id],
    createdBy: inviterUserId,
  }).catch((err) => {
    console.error("[booth-staff] auto-invite failed", err);
  });

  return { member: serializeMember(participant) };
}

/** 移除团队成员：解除展位绑定，保留 Participant 以维护历史线索归属 */
export async function removeBoothStaffMember(
  boothId: string,
  participantId: string,
): Promise<void> {
  const member = await prisma.participant.findFirst({
    where: {
      id: participantId,
      boothId,
      systemRole: SystemRole.EXHIBITOR,
    },
  });

  if (!member) {
    throw new ApiError("团队成员不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (member.isBoothOwner) {
    throw new ApiError("不能移除展位主账号", ErrorCode.VALIDATION_ERROR, 400);
  }

  await prisma.participant.update({
    where: { id: participantId },
    data: {
      boothId: null,
      isBoothOwner: false,
      systemRole: SystemRole.PARTICIPANT,
    },
  });
}
