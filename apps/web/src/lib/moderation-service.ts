import { ConnectionStatus, prisma } from "@connectiq/database";
import {
  getPollDisplayConfig,
  updatePollDisplayConfig,
} from "@/lib/bigscreen-service";

export type ModerationItem = {
  id: string;
  type: "QNA" | "CONNECTION" | "FEED";
  title: string;
  content: string;
  author: string;
  createdAt: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  meta: Record<string, string>;
};

export async function listModerationQueue(limit = 50): Promise<ModerationItem[]> {
  const items: ModerationItem[] = [];

  const qnaPolls = await prisma.poll.findMany({
    where: { type: "QNA" },
    select: { id: true, title: true, eventId: true, event: { select: { name: true } } },
    take: 20,
    orderBy: { updatedAt: "desc" },
  });

  for (const poll of qnaPolls) {
    const display = await getPollDisplayConfig(poll.eventId, poll.id);
    const hidden = new Set(display.hiddenResponseIds ?? []);
    const responses = await prisma.pollResponse.findMany({
      where: {
        pollId: poll.id,
        textAnswer: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        participant: { select: { name: true, company: true } },
      },
    });
    for (const r of responses) {
      if (!r.textAnswer?.trim()) continue;
      items.push({
        id: `qna:${r.id}`,
        type: "QNA",
        title: poll.title,
        content: r.textAnswer.trim(),
        author: r.participant?.name ?? "匿名",
        createdAt: r.createdAt.toISOString(),
        status: hidden.has(r.id) ? "REJECTED" : "PENDING",
        meta: {
          pollId: poll.id,
          responseId: r.id,
          eventId: poll.eventId,
          eventName: poll.event.name,
        },
      });
    }
  }

  const connections = await prisma.businessConnection.findMany({
    where: { originContext: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      event: { select: { name: true } },
    },
  });

  for (const c of connections) {
    const ctx = c.originContext?.trim();
    if (!ctx) continue;
    items.push({
      id: `conn:${c.id}`,
      type: "CONNECTION",
      title: `${c.userAName} ↔ ${c.userBName}`,
      content: ctx,
      author: c.userAName,
      createdAt: c.createdAt.toISOString(),
      status: c.status === ConnectionStatus.INACTIVE ? "REJECTED" : "PENDING",
      meta: {
        connectionId: c.id,
        eventName: c.eventName ?? c.event?.name ?? "",
      },
    });
  }

  const feeds = await prisma.feedItem.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { user: { select: { name: true } } },
  });

  for (const f of feeds) {
    items.push({
      id: `feed:${f.id}`,
      type: "FEED",
      title: f.type,
      content: f.content.slice(0, 500),
      author: f.user.name,
      createdAt: f.createdAt.toISOString(),
      status: "PENDING",
      meta: { feedId: f.id },
    });
  }

  return items
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function moderateItem(
  itemId: string,
  action: "approve" | "reject",
) {
  const [kind, id] = itemId.split(":");
  if (!kind || !id) throw new Error("无效条目");

  if (kind === "qna") {
    const response = await prisma.pollResponse.findUnique({
      where: { id },
      include: { poll: { select: { id: true, eventId: true } } },
    });
    if (!response?.poll) throw new Error("问答不存在");
    const display = await getPollDisplayConfig(
      response.poll.eventId,
      response.poll.id,
    );
    const hidden = new Set(display.hiddenResponseIds ?? []);
    if (action === "reject") hidden.add(id);
    else hidden.delete(id);
    await updatePollDisplayConfig(response.poll.eventId, response.poll.id, {
      hiddenResponseIds: [...hidden],
    });
    return { ok: true };
  }

  if (kind === "conn") {
    await prisma.businessConnection.update({
      where: { id },
      data: {
        status:
          action === "reject"
            ? ConnectionStatus.INACTIVE
            : ConnectionStatus.ACTIVE,
      },
    });
    return { ok: true };
  }

  if (kind === "feed") {
    if (action === "reject") {
      await prisma.feedItem.delete({ where: { id } });
    }
    return { ok: true };
  }

  throw new Error("未知类型");
}

export async function countPendingModeration() {
  const queue = await listModerationQueue(200);
  return queue.filter((i) => i.status === "PENDING").length;
}
