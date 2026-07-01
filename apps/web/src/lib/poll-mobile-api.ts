import { PollStatus, type Poll, type PollOption } from "@connectiq/database";

/** 进行中投票：LIVE；OPEN/ACTIVE 为小程序侧别名 */
export const RUNNING_POLL_STATUSES: PollStatus[] = [
  PollStatus.LIVE,
  PollStatus.PAUSED,
];

type PollWithMeta = Poll & {
  options?: PollOption[];
  _count?: { responses: number };
};

export function resolvePollListStatusFilter(
  statusParam: string | null,
  scopeParam: string | null,
): PollStatus[] | undefined {
  const raw = (statusParam ?? scopeParam ?? "").trim().toUpperCase();
  if (!raw) return undefined;

  if (raw === "ACTIVE" || raw === "RUNNING" || raw === "OPEN") {
    return RUNNING_POLL_STATUSES;
  }

  const parts = raw.split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  const mapped = parts.flatMap((part) => {
    if (part === "ACTIVE" || part === "RUNNING" || part === "OPEN") {
      return RUNNING_POLL_STATUSES;
    }
    if (Object.values(PollStatus).includes(part as PollStatus)) {
      return [part as PollStatus];
    }
    return [];
  });

  return mapped.length > 0 ? [...new Set(mapped)] : undefined;
}

export function buildPollBigscreenUrl(eventId: string, pollId?: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://app.connectiq.cn";
  const root = base.replace(/\/$/, "");
  const params = new URLSearchParams({ tab: "poll" });
  if (pollId) params.set("poll", pollId);
  return `${root}/events/${eventId}/interactions/bigscreen?${params.toString()}`;
}

export function serializePollForMobile(
  poll: PollWithMeta,
  eventId: string,
) {
  const participantCount = poll._count?.responses ?? 0;
  const endsAt = poll.closesAt?.toISOString() ?? null;

  return {
    id: poll.id,
    eventId: poll.eventId,
    title: poll.title,
    type: poll.type,
    status: poll.status,
    showResults: poll.showResults,
    closesAt: endsAt,
    ends_at: endsAt,
    scheduledAt: poll.scheduledAt?.toISOString() ?? null,
    displayOrder: poll.displayOrder,
    createdAt: poll.createdAt.toISOString(),
    updatedAt: poll.updatedAt.toISOString(),
    participant_count: participantCount,
    options: poll.options ?? [],
    bigscreen_url: buildPollBigscreenUrl(eventId, poll.id),
    realtime_url: `/api/events/${eventId}/polls/${poll.id}/realtime-results`,
    sse_url: `/api/events/${eventId}/polls/${poll.id}/realtime-results?stream=sse`,
  };
}

export function serializePollOptionResults(
  options: Array<{
    id: string;
    text: string;
    count: number;
    percentage: number;
  }>,
) {
  return options.map((option) => ({
    ...option,
    vote_count: option.count,
  }));
}
