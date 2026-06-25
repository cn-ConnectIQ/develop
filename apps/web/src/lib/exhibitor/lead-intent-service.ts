import { SignalType, prisma } from "@connectiq/database";

export type AiIntentLevel = "A" | "B" | "C";

const INTERACTION_SIGNALS: SignalType[] = [
  SignalType.POLL_ANSWERED,
  SignalType.QNA_ASKED,
  SignalType.QNA_UPVOTED,
  SignalType.INTERACTION_JOINED,
];

export function computeAiIntentFromSignals(
  boothSignals: Array<{ signalType: SignalType }>,
): AiIntentLevel {
  const hasLead = boothSignals.some(
    (s) => s.signalType === SignalType.BOOTH_LEAD_CAPTURED,
  );
  const hasInteraction = boothSignals.some((s) =>
    INTERACTION_SIGNALS.includes(s.signalType),
  );
  const scanCount = boothSignals.filter(
    (s) => s.signalType === SignalType.BOOTH_SCAN,
  ).length;

  if (hasLead && hasInteraction && scanCount >= 2) return "A";
  if (hasLead || hasInteraction) return "B";
  return "C";
}

export async function resolveUserIdForParticipant(
  eventId: string,
  participant: { email: string | null; phone: string | null },
): Promise<string | null> {
  const or: Array<{ email?: string; phone?: string }> = [];
  if (participant.email) or.push({ email: participant.email });
  if (participant.phone) or.push({ phone: participant.phone });
  if (or.length === 0) return null;

  const user = await prisma.user.findFirst({
    where: { OR: or },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function computeLeadAiIntentLevel(
  boothId: string,
  eventId: string,
  participant: { email: string | null; phone: string | null },
  storedGrade: string | null,
): Promise<AiIntentLevel> {
  if (storedGrade === "A" || storedGrade === "B" || storedGrade === "C") {
    return storedGrade;
  }

  const userId = await resolveUserIdForParticipant(eventId, participant);
  if (!userId) {
    return "B";
  }

  const signals = await prisma.boothVisitSignal.findMany({
    where: { userId, eventId, entityId: boothId },
    select: { signalType: true },
  });

  if (signals.length === 0) {
    return "B";
  }

  return computeAiIntentFromSignals(signals);
}
