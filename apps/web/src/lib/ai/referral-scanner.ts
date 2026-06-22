import {
  ConnectionStatus,
  FeedItemType,
  ReferralStatus,
  prisma,
} from "@connectiq/database";
import { parseIntentTags } from "@/lib/user-me-service";

export interface ReferralOpportunity {
  introducerId: string;
  supplierUserId: string;
  demanderUserId: string;
  matchTag: string;
  score: number;
}

export function calculateReferralScore(
  _tag: string,
  suppliers: string[],
  demanders: string[],
): number {
  const scarcity = demanders.length / Math.max(suppliers.length, 1);
  return Math.min(5, scarcity * 2);
}

function referralKey(introducerId: string, supplierId: string, demanderId: string) {
  return `${introducerId}:${supplierId}:${demanderId}`;
}

async function resolveParticipantUsers(
  participants: Array<{ id: string; email: string | null; phone: string | null }>,
) {
  const emails = [
    ...new Set(participants.map((p) => p.email).filter(Boolean) as string[]),
  ];
  const phones = [
    ...new Set(participants.map((p) => p.phone).filter(Boolean) as string[]),
  ];

  if (emails.length === 0 && phones.length === 0) {
    return new Map<string, string>();
  }

  const users = await prisma.user.findMany({
    where: {
      OR: [
        ...(emails.length > 0 ? [{ email: { in: emails } }] : []),
        ...(phones.length > 0 ? [{ phone: { in: phones } }] : []),
      ],
    },
    select: { id: true, email: true, phone: true },
  });

  const byEmail = new Map(users.map((u) => [u.email, u.id]));
  const byPhone = new Map(
    users.filter((u) => u.phone).map((u) => [u.phone!, u.id]),
  );

  const participantToUser = new Map<string, string>();
  for (const p of participants) {
    const userId =
      (p.email && byEmail.get(p.email)) ||
      (p.phone && byPhone.get(p.phone)) ||
      null;
    if (userId) participantToUser.set(p.id, userId);
  }
  return participantToUser;
}

export async function scanReferralOpportunities(eventId: string) {
  const participants = await prisma.participant.findMany({
    where: {
      eventId,
      checkIns: { some: { eventId } },
    },
    select: { id: true, email: true, phone: true },
  });

  const participantToUser = await resolveParticipantUsers(participants);
  const userIds = [...new Set(participantToUser.values())];

  if (userIds.length === 0) {
    await prisma.aIReferralScan.create({
      data: { eventId, pairsFound: 0, feedsCreated: 0 },
    });
    return { opportunitiesFound: 0, feedsCreated: 0 };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      name: true,
      profile: { select: { intentTags: true, company: true } },
      connectionsAsA: {
        where: { status: ConnectionStatus.ACTIVE },
        select: { userBId: true },
      },
      connectionsAsB: {
        where: { status: ConnectionStatus.ACTIVE },
        select: { userAId: true },
      },
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const knownMap = new Map<string, Set<string>>();
  const supplyMap = new Map<string, string[]>();
  const demandMap = new Map<string, string[]>();

  for (const userId of userIds) {
    const user = userMap.get(userId);
    if (!user) continue;

    const known = new Set<string>();
    for (const c of user.connectionsAsA) {
      if (c.userBId) known.add(c.userBId);
    }
    for (const c of user.connectionsAsB) {
      if (c.userAId) known.add(c.userAId);
    }
    knownMap.set(userId, known);

    const intents = parseIntentTags(user.profile?.intentTags);
    for (const intent of intents) {
      const tag = intent.label.trim();
      if (!tag) continue;
      if (intent.type === "SUPPLY") {
        const arr = supplyMap.get(tag) ?? [];
        arr.push(userId);
        supplyMap.set(tag, arr);
      } else if (intent.type === "DEMAND") {
        const arr = demandMap.get(tag) ?? [];
        arr.push(userId);
        demandMap.set(tag, arr);
      }
    }
  }

  const existingReferrals = await prisma.businessReferral.findMany({
    where: {
      eventId,
      status: { not: ReferralStatus.DECLINED },
      introducerId: { in: userIds },
    },
    select: { introducerId: true, userAId: true, userBId: true },
  });

  const existingReferralKeys = new Set(
    existingReferrals.map((r) =>
      referralKey(r.introducerId, r.userAId ?? "", r.userBId ?? ""),
    ),
  );

  const opportunities: ReferralOpportunity[] = [];

  for (const introducerId of userIds) {
    const knownByIntroducer = knownMap.get(introducerId) ?? new Set<string>();

    for (const tag of supplyMap.keys()) {
      const suppliers = supplyMap.get(tag) ?? [];
      const demanders = demandMap.get(tag) ?? [];
      if (demanders.length === 0) continue;

      for (const supplierId of suppliers) {
        if (!knownByIntroducer.has(supplierId)) continue;
        if (supplierId === introducerId) continue;

        for (const demanderId of demanders) {
          if (!knownByIntroducer.has(demanderId)) continue;
          if (demanderId === introducerId) continue;
          if (supplierId === demanderId) continue;

          const bcKnown = knownMap.get(supplierId)?.has(demanderId);
          if (bcKnown) continue;

          if (
            existingReferralKeys.has(
              referralKey(introducerId, supplierId, demanderId),
            )
          ) {
            continue;
          }

          const score = calculateReferralScore(tag, suppliers, demanders);
          opportunities.push({
            introducerId,
            supplierUserId: supplierId,
            demanderUserId: demanderId,
            matchTag: tag,
            score,
          });
        }
      }
    }
  }

  const grouped = new Map<string, ReferralOpportunity[]>();
  for (const opp of opportunities) {
    const arr = grouped.get(opp.introducerId) ?? [];
    arr.push(opp);
    grouped.set(opp.introducerId, arr);
  }

  let feedsCreated = 0;
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  for (const [introducerId, opps] of grouped.entries()) {
    const top = opps.sort((a, b) => b.score - a.score).slice(0, 3);

    for (const opp of top) {
      const supplier = userMap.get(opp.supplierUserId);
      const demander = userMap.get(opp.demanderUserId);
      const supplierName = supplier?.name ?? "某位参会者";
      const demanderName = demander?.name ?? "某位参会者";
      const supplierCompany =
        supplier?.profile?.company ?? "未知公司";
      const demanderCompany =
        demander?.profile?.company ?? "未知公司";

      await prisma.feedItem.create({
        data: {
          userId: introducerId,
          eventId,
          type: FeedItemType.AI_REFERRAL,
          aiScore: Math.min(5, Math.round(opp.score)),
          triggerReason: `${supplierName}（${supplierCompany}）有 ${opp.matchTag} 能力，${demanderName}（${demanderCompany}）正在寻找`,
          content: JSON.stringify({
            supplier_user_id: opp.supplierUserId,
            demander_user_id: opp.demanderUserId,
            match_tag: opp.matchTag,
            event_id: eventId,
            expires_at: expiresAt.toISOString(),
          }),
          expiresAt,
        },
      });
      feedsCreated++;
    }
  }

  await prisma.aIReferralScan.create({
    data: {
      eventId,
      pairsFound: opportunities.length,
      feedsCreated,
    },
  });

  return { opportunitiesFound: opportunities.length, feedsCreated };
}

const CHECKIN_MILESTONE_KEY = "ai_referral_scan_checkin_50";
const POST_START_2H_KEY = "ai_referral_scan_post_start_2h";

async function markAutoScanDone(eventId: string, key: string) {
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key } },
    create: { eventId, key, value: { done: true, at: new Date().toISOString() } },
    update: { value: { done: true, at: new Date().toISOString() } },
  });
}

async function hasAutoScanDone(eventId: string, key: string) {
  const setting = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key } },
  });
  return Boolean(setting);
}

/** 签到人数达到 50 时自动触发（仅一次） */
export async function maybeTriggerReferralScanOnCheckin(eventId: string) {
  const checkedIn = await prisma.checkIn.count({ where: { eventId } });
  if (checkedIn < 50) return null;
  if (await hasAutoScanDone(eventId, CHECKIN_MILESTONE_KEY)) return null;

  const result = await scanReferralOpportunities(eventId);
  await markAutoScanDone(eventId, CHECKIN_MILESTONE_KEY);
  return result;
}

/** 活动开始后 2 小时自动触发（仅一次） */
export async function maybeTriggerReferralScanPostStart(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { startDate: true },
  });
  if (!event?.startDate) return null;

  const twoHoursAfterStart = event.startDate.getTime() + 2 * 60 * 60 * 1000;
  if (Date.now() < twoHoursAfterStart) return null;
  if (await hasAutoScanDone(eventId, POST_START_2H_KEY)) return null;

  const result = await scanReferralOpportunities(eventId);
  await markAutoScanDone(eventId, POST_START_2H_KEY);
  return result;
}

/** 供 cron 批量扫描已开始 2 小时以上的活动 */
export async function runPostStartReferralScans() {
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const events = await prisma.event.findMany({
    where: {
      startDate: { lte: cutoff },
      status: { in: ["PUBLISHED", "LIVE"] },
    },
    select: { id: true },
  });

  const results: Array<{ eventId: string; result: Awaited<ReturnType<typeof scanReferralOpportunities>> | null }> = [];
  for (const event of events) {
    const result = await maybeTriggerReferralScanPostStart(event.id);
    results.push({ eventId: event.id, result });
  }
  return results;
}

export async function getLatestReferralScan(eventId: string) {
  return prisma.aIReferralScan.findFirst({
    where: { eventId },
    orderBy: { scannedAt: "desc" },
  });
}
