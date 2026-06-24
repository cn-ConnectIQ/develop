import { prisma } from "@connectiq/database";
import { notifyParticipants } from "@/lib/participant-notify-service";
import { POLL_TYPE_LABELS } from "@/lib/interactions";

export type InteractionPushKind = "poll" | "lottery" | "qna";

export async function notifyAllEventParticipants(input: {
  eventId: string;
  title: string;
  body: string;
}) {
  const participants = await prisma.participant.findMany({
    where: { eventId: input.eventId },
    select: { id: true },
  });
  return notifyParticipants({
    eventId: input.eventId,
    participantIds: participants.map((p) => p.id),
    title: input.title,
    body: input.body,
  });
}

export function buildPollPushCopy(poll: { title: string; type: string }) {
  const typeLabel = POLL_TYPE_LABELS[poll.type] ?? "互动";
  return {
    title: `现场互动：${poll.title}`,
    body: `「${typeLabel}」已开启，请打开活动现场参与「${poll.title}」。`,
  };
}

export function buildLotteryPushCopy(lottery: { title: string }) {
  return {
    title: `现场抽奖：${lottery.title}`,
    body: `「${lottery.title}」已开放参与，请打开活动现场查看抽奖详情。`,
  };
}

export function buildQnaPushCopy(poll: { title: string }) {
  return {
    title: `现场提问：${poll.title}`,
    body: `「${poll.title}」已开启提问收集，欢迎提交你的问题。`,
  };
}

export async function pushPollToAttendees(eventId: string, pollId: string) {
  const poll = await prisma.poll.findFirst({
    where: { id: pollId, eventId },
    select: { title: true, type: true },
  });
  if (!poll) throw new Error("投票不存在");
  const copy =
    poll.type === "QNA"
      ? buildQnaPushCopy(poll)
      : buildPollPushCopy(poll);
  return notifyAllEventParticipants({ eventId, ...copy });
}

export async function pushLotteryToAttendees(eventId: string, lotteryId: string) {
  const lottery = await prisma.lottery.findFirst({
    where: { id: lotteryId, eventId },
    select: { title: true },
  });
  if (!lottery) throw new Error("抽奖不存在");
  const copy = buildLotteryPushCopy(lottery);
  return notifyAllEventParticipants({ eventId, ...copy });
}
