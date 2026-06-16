import { ReferralStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiUserBasic = {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  title?: string;
};

export type ApiReferralItem = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  introducer: ApiUserBasic;
  user_a: ApiUserBasic;
  user_b: ApiUserBasic;
  message: string | null;
  result_connection_id: string | null;
  ai_confidence: number | null;
  ai_generated_message: string | null;
  event: { id: string; name: string } | null;
  created_at: string;
};

export type ReferralStats = {
  total: number;
  accepted: number;
  pending: number;
};

const userInclude = {
  profile: { select: { company: true } },
} as const;

function mapUser(
  id: string | null | undefined,
  name: string,
  company?: string | null,
  title?: string | null,
  profileCompany?: string | null,
): ApiUserBasic {
  return {
    id: id ?? `anon-${name}`,
    name,
    company: company ?? profileCompany ?? undefined,
    title: title ?? undefined,
  };
}

function mapReferralRow(row: {
  id: string;
  status: ReferralStatus;
  message: string | null;
  aiConfidence: number | null;
  aiGeneratedMessage: string | null;
  eventId: string | null;
  eventName: string | null;
  resultConnectionId: string | null;
  createdAt: Date;
  userAName: string;
  userACompany: string | null;
  userATitle: string | null;
  userBName: string;
  userBCompany: string | null;
  userBTitle: string | null;
  userAId: string | null;
  userBId: string | null;
  introducer: { id: string; name: string; profile: { company: string | null } | null };
  userA: { id: string; name: string; profile: { company: string | null } | null } | null;
  userB: { id: string; name: string; profile: { company: string | null } | null } | null;
}): ApiReferralItem {
  return {
    id: row.id,
    status: row.status,
    introducer: mapUser(
      row.introducer.id,
      row.introducer.name,
      row.introducer.profile?.company,
    ),
    user_a: mapUser(
      row.userAId ?? row.userA?.id,
      row.userAName,
      row.userACompany,
      row.userATitle,
      row.userA?.profile?.company,
    ),
    user_b: mapUser(
      row.userBId ?? row.userB?.id,
      row.userBName,
      row.userBCompany,
      row.userBTitle,
      row.userB?.profile?.company,
    ),
    message: row.message,
    result_connection_id: row.resultConnectionId,
    ai_confidence: row.aiConfidence,
    ai_generated_message: row.aiGeneratedMessage,
    event:
      row.eventId && row.eventName
        ? { id: row.eventId, name: row.eventName }
        : null,
    created_at: row.createdAt.toISOString(),
  };
}

function computeStats(items: ApiReferralItem[]): ReferralStats {
  return {
    total: items.length,
    accepted: items.filter(
      (r) => r.status === "ACCEPTED" || Boolean(r.result_connection_id),
    ).length,
    pending: items.filter(
      (r) => r.status === "PENDING" && !r.result_connection_id,
    ).length,
  };
}

const referralInclude = {
  introducer: { include: userInclude },
  userA: { include: userInclude },
  userB: { include: userInclude },
} as const;

export async function listReferrals(
  userId: string,
  role: "introducer" | "recipient",
  limit: number,
): Promise<{
  referrals: ApiReferralItem[];
  stats: ReferralStats;
  counts: { introducer: number; recipient: number };
}> {
  const take = Math.min(Math.max(limit, 1), 100);
  const where =
    role === "introducer" ? { introducerId: userId } : { recipientId: userId };

  const [rows, introducerCount, recipientCount] = await Promise.all([
    prisma.businessReferral.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: referralInclude,
    }),
    prisma.businessReferral.count({ where: { introducerId: userId } }),
    prisma.businessReferral.count({ where: { recipientId: userId } }),
  ]);

  const referrals = rows.map(mapReferralRow);

  return {
    referrals,
    stats: computeStats(referrals),
    counts: { introducer: introducerCount, recipient: recipientCount },
  };
}

async function getReferralForUser(referralId: string, userId: string) {
  const row = await prisma.businessReferral.findUnique({
    where: { id: referralId },
    include: referralInclude,
  });

  if (!row) {
    throw new ApiError("引荐不存在", ErrorCode.NOT_FOUND, 404);
  }

  const isIntroducer = row.introducerId === userId;
  const isRecipient = row.recipientId === userId;
  if (!isIntroducer && !isRecipient) {
    throw new ApiError("无权操作", ErrorCode.FORBIDDEN, 403);
  }

  return { row, isIntroducer, isRecipient };
}

export async function remindReferral(userId: string, referralId: string) {
  const { row, isIntroducer } = await getReferralForUser(referralId, userId);
  if (!isIntroducer) {
    throw new ApiError("仅引荐人可发送提醒", ErrorCode.FORBIDDEN, 403);
  }
  if (row.status !== ReferralStatus.PENDING) {
    throw new ApiError("当前状态不可提醒", ErrorCode.VALIDATION_ERROR, 400);
  }

  await prisma.$transaction([
    prisma.notification.create({
      data: {
        userId: row.recipientId,
        title: "引荐提醒",
        body: `${row.introducer.name} 提醒你查看引荐：${row.userAName} ↔ ${row.userBName}`,
      },
    }),
    prisma.businessReferral.update({
      where: { id: referralId },
      data: { remindedAt: new Date() },
    }),
  ]);

  return { ok: true };
}

export async function acceptReferral(userId: string, referralId: string) {
  const { row, isRecipient } = await getReferralForUser(referralId, userId);
  if (!isRecipient) {
    throw new ApiError("仅接收方可接受引荐", ErrorCode.FORBIDDEN, 403);
  }
  if (row.status !== ReferralStatus.PENDING) {
    throw new ApiError("当前状态不可接受", ErrorCode.VALIDATION_ERROR, 400);
  }

  const updated = await prisma.businessReferral.update({
    where: { id: referralId },
    data: { status: ReferralStatus.ACCEPTED },
    include: referralInclude,
  });

  return mapReferralRow(updated);
}

export async function declineReferral(
  userId: string,
  referralId: string,
  options?: { withdrawn?: boolean },
) {
  const { row, isIntroducer, isRecipient } = await getReferralForUser(
    referralId,
    userId,
  );

  if (options?.withdrawn) {
    if (!isIntroducer) {
      throw new ApiError("仅引荐人可撤回", ErrorCode.FORBIDDEN, 403);
    }
  } else if (!isRecipient) {
    throw new ApiError("仅接收方可拒绝引荐", ErrorCode.FORBIDDEN, 403);
  }

  if (row.status !== ReferralStatus.PENDING) {
    throw new ApiError("当前状态不可变更", ErrorCode.VALIDATION_ERROR, 400);
  }

  const updated = await prisma.businessReferral.update({
    where: { id: referralId },
    data: {
      status: ReferralStatus.DECLINED,
      message: options?.withdrawn ? "引荐人已撤回" : row.message,
    },
    include: referralInclude,
  });

  return mapReferralRow(updated);
}
