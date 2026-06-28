import { FeedItemType, SignalType, type Prisma, prisma } from "@connectiq/database";
import type { HighValueBuyerPushConfig } from "@/lib/high-value-buyer-push-config";
import { DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG } from "@/lib/high-value-buyer-push-config";

export { SignalType };

const HIGH_VALUE_SIGNALS: SignalType[] = [
  SignalType.BOOTH_LEAD_CAPTURED,
  SignalType.BOOTH_SCAN,
];

export type HighIntentBuyer = {
  buyer_user_id: string;
  name: string;
  company: string | null;
  intent_level: "A" | "B";
  occurred_at: string;
};

function computeIntentLevel(
  userSignals: Array<{ signalType: SignalType; entityId: string | null }>,
  boothId: string,
  config: HighValueBuyerPushConfig = DEFAULT_HIGH_VALUE_BUYER_PUSH_CONFIG,
): "A" | "B" | null {
  const boothSignals = userSignals.filter((s) => s.entityId === boothId);
  const leadCaptured = boothSignals.some(
    (s) => s.signalType === SignalType.BOOTH_LEAD_CAPTURED,
  );
  if (config.a_level_on_lead_capture && leadCaptured) return "A";

  const scanCount = boothSignals.filter(
    (s) => s.signalType === SignalType.BOOTH_SCAN,
  ).length;
  if (scanCount >= config.b_level_scan_threshold) return "B";

  return null;
}

async function checkAndNotifyExhibitor(
  userId: string,
  eventId: string,
  signalType: SignalType,
  entityId?: string,
) {
  if (!HIGH_VALUE_SIGNALS.includes(signalType)) return;
  if (!entityId) return;

  const { isEventFeatureEnabled } = await import("@/lib/event-feature-flags-server");
  const pushEnabled = await isEventFeatureEnabled(eventId, "highValueBuyerPush");
  if (!pushEnabled) return;

  const { getHighValueBuyerPushConfig } = await import(
    "@/lib/high-value-buyer-push-config"
  );
  const pushConfig = await getHighValueBuyerPushConfig(eventId);

  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: entityId },
    include: {
      companyOrg: {
        select: { ownerId: true, name: true },
      },
    },
  });
  if (!booth) return;

  const recipientId = booth.companyOrg.ownerId ?? booth.operatorUserId;
  if (!recipientId) return;

  const userSignals = await prisma.boothVisitSignal.findMany({
    where: { userId, eventId },
    orderBy: { occurredAt: "desc" },
    take: 20,
    select: { signalType: true, entityId: true },
  });

  const intentLevel = computeIntentLevel(userSignals, entityId, pushConfig);
  if (!intentLevel) return;

  const cooldownMs = pushConfig.cooldown_minutes * 60 * 1000;
  const recentNotif = await prisma.notification.findFirst({
    where: {
      userId: recipientId,
      body: { contains: userId },
      createdAt: { gt: new Date(Date.now() - cooldownMs) },
    },
  });
  if (recentNotif) return;

  const buyer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      profile: { select: { company: true } },
    },
  });

  const buyerName = buyer?.name ?? "访客";
  const buyerCompany = buyer?.profile?.company ?? "—";

  if (pushConfig.notify_exhibitor) {
    await prisma.notification.create({
      data: {
        userId: recipientId,
        title: `🎯 ${intentLevel} 级意向买家关注了你的展位`,
        body: `${buyerName}（${buyerCompany}）正在关注 ${booth.code} 展位，意向等级：${intentLevel} 级。建议主动邀请洽谈。\n<!--buyer:${userId}-->`,
      },
    });
  }

  if (pushConfig.notify_feed) {
    await prisma.feedItem.create({
      data: {
        userId: recipientId,
        eventId,
        type: FeedItemType.INSIGHT,
        aiScore: intentLevel === "A" ? 5 : 3,
        triggerReason: `${buyerName} 对你的展位表现出 ${intentLevel} 级兴趣`,
        content: JSON.stringify({
          buyer_user_id: userId,
          booth_id: entityId,
          intent_level: intentLevel,
          buyer_name: buyerName,
          buyer_company: buyerCompany,
        }),
      },
    });
  }
}

export async function listHighIntentBuyersForBooth(
  boothId: string,
  eventId: string,
  limit = 5,
): Promise<HighIntentBuyer[]> {
  const { getHighValueBuyerPushConfig } = await import(
    "@/lib/high-value-buyer-push-config"
  );
  const pushConfig = await getHighValueBuyerPushConfig(eventId);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const signals = await prisma.boothVisitSignal.findMany({
    where: {
      eventId,
      entityId: boothId,
      signalType: { in: HIGH_VALUE_SIGNALS },
      occurredAt: { gte: todayStart },
    },
    orderBy: { occurredAt: "desc" },
    select: {
      userId: true,
      signalType: true,
      entityId: true,
      occurredAt: true,
    },
  });

  const signalsByUser = new Map<
    string,
    Array<{ signalType: SignalType; entityId: string | null; occurredAt: Date }>
  >();

  for (const signal of signals) {
    const list = signalsByUser.get(signal.userId) ?? [];
    list.push(signal);
    signalsByUser.set(signal.userId, list);
  }

  const ranked: Array<{
    userId: string;
    intentLevel: "A" | "B";
    occurredAt: Date;
  }> = [];

  for (const [signalUserId, userSignals] of signalsByUser) {
    const intentLevel = computeIntentLevel(userSignals, boothId, pushConfig);
    if (!intentLevel) continue;
    ranked.push({
      userId: signalUserId,
      intentLevel,
      occurredAt: userSignals[0]!.occurredAt,
    });
  }

  ranked.sort((a, b) => {
    if (a.intentLevel !== b.intentLevel) {
      return a.intentLevel === "A" ? -1 : 1;
    }
    return b.occurredAt.getTime() - a.occurredAt.getTime();
  });

  const top = ranked.slice(0, limit);
  if (top.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { id: { in: top.map((row) => row.userId) } },
    select: {
      id: true,
      name: true,
      profile: { select: { company: true } },
    },
  });
  const userById = new Map(users.map((user) => [user.id, user]));

  return top.map((row) => {
    const user = userById.get(row.userId);
    return {
      buyer_user_id: row.userId,
      name: user?.name ?? "访客",
      company: user?.profile?.company ?? null,
      intent_level: row.intentLevel,
      occurred_at: row.occurredAt.toISOString(),
    };
  });
}

export async function recordSignal(
  userId: string,
  eventId: string,
  type: SignalType,
  entityId?: string,
  entityType?: string,
  payload?: Record<string, unknown>,
) {
  try {
    await prisma.boothVisitSignal.create({
      data: {
        userId,
        eventId,
        signalType: type,
        entityId,
        entityType,
        payload: (payload ?? {}) as Prisma.InputJsonValue,
      },
    });

    void checkAndNotifyExhibitor(userId, eventId, type, entityId).catch((err) =>
      console.warn("[HighValueBuyer] notify failed:", err),
    );
  } catch (err) {
    console.warn("[Signal] write failed:", err);
  }
}
