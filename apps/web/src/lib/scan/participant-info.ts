import { prisma } from "@connectiq/database";
import type { ScanParticipantView } from "./types";

function resolveAvatarUrl(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.slice(0, 1) || "?")}`;
}

/** 根据 UserEventCode 关联用户构建操作端展示用的参会者信息 */
export async function buildScanParticipantView(
  eventId: string,
  userId: string,
): Promise<ScanParticipantView> {
  const { findParticipantForUser } = await import(
    "@/lib/interaction/participant-user"
  );

  const [user, participant] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        profile: { select: { company: true } },
      },
    }),
    findParticipantForUser(eventId, userId),
  ]);

  const name = user?.name ?? participant?.name ?? "参会者";
  const company = user?.profile?.company ?? participant?.company ?? null;

  return {
    name,
    company,
    avatar: resolveAvatarUrl(name),
    tags: participant?.tags ?? [],
  };
}
