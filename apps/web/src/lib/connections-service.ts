import {
  ConnectionSource,
  ConnectionStatus,
  prisma,
} from "@connectiq/database";
import { computeContactTiming } from "./network-timing-shared";

export type ApiConnectionUser = {
  id: string;
  name: string;
  avatar_url?: string;
  company?: string;
  title?: string;
  network_score?: number;
};

export type ApiNetworkConnectionItem = {
  id: string;
  user: ApiConnectionUser;
  origin_event: { id: string; name: string } | null;
  origin_context: string;
  depth_score: number;
  meeting_quality_score: number | null;
  connected_at: string;
  contact_timing: "hot" | "warm" | "cool" | "cold";
  timing_reason: string | null;
};

function formatOriginContext(source: ConnectionSource, ctx: string | null): string {
  if (ctx) return ctx;
  switch (source) {
    case ConnectionSource.AI_RECOMMEND:
      return "AI 推荐";
    case ConnectionSource.SPEED_NETWORKING:
      return "Speed Networking";
    case ConnectionSource.REFERRAL:
      return "主动引荐";
    case ConnectionSource.SCAN:
    default:
      return "活动扫码认识";
  }
}

function mapPeerUser(input: {
  userId: string | null;
  name: string;
  company: string | null;
  profile?: { company: string | null } | null;
}): ApiConnectionUser {
  return {
    id: userId ?? `peer-${name}`,
    name,
    company: company ?? profile?.company ?? undefined,
    network_score: undefined,
  };
}

export async function listActiveConnections(
  userId: string,
  limit: number,
): Promise<ApiNetworkConnectionItem[]> {
  const rows = await prisma.businessConnection.findMany({
    where: {
      status: ConnectionStatus.ACTIVE,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(limit, 1), 100),
    include: {
      interactions: {
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
      userA: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true } },
        },
      },
      userB: {
        select: {
          id: true,
          name: true,
          profile: { select: { company: true } },
        },
      },
    },
  });

  return rows.map((row) => {
    const isCurrentUserA = row.userAId === userId;
    const peerId = isCurrentUserA ? row.userBId : row.userAId;
    const peerName = isCurrentUserA ? row.userBName : row.userAName;
    const peerCompany = isCurrentUserA ? row.userBCompany : row.userACompany;
    const peerProfile = isCurrentUserA ? row.userB?.profile : row.userA?.profile;

    const depthScore = Math.min(10, Math.max(1, row.depth));
    const lastInteraction = row.interactions[0]?.occurredAt?.toISOString() ?? null;
    const timing = computeContactTiming({
      depth_score: depthScore,
      connected_at: row.createdAt.toISOString(),
      last_interaction_at: lastInteraction,
    });

    const meetingQuality =
      row.aiScore != null ? Math.round((row.aiScore / 100) * 5 * 10) / 10 : null;

    return {
      id: row.id,
      user: mapPeerUser({
        userId: peerId,
        name: peerName,
        company: peerCompany,
        profile: peerProfile,
      }),
      origin_event:
        row.eventId && row.eventName
          ? { id: row.eventId, name: row.eventName }
          : null,
      origin_context: formatOriginContext(row.source, row.originContext),
      depth_score: depthScore,
      meeting_quality_score: meetingQuality,
      connected_at: row.createdAt.toISOString(),
      contact_timing: timing.contact_timing,
      timing_reason: timing.timing_reason,
    };
  });
}
