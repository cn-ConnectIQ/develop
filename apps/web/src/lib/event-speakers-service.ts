import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type ApiEventSpeaker = {
  id: string;
  name: string;
  title: string | null;
  bio: string | null;
  avatar_url: string | null;
};

export async function listEventSpeakers(eventId: string): Promise<ApiEventSpeaker[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const rows = await prisma.speaker.findMany({
    where: { eventId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      title: true,
      bio: true,
      avatarUrl: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    title: row.title,
    bio: row.bio,
    avatar_url: row.avatarUrl,
  }));
}
