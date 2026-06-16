import { EventStatus, MeetingStatus, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import { mapMeetingToScheduleItem } from "@/lib/meetings-service";

export type ApiEventOrg = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_verified: boolean;
};

function mapEventStatus(status: EventStatus): "DRAFT" | "PUBLISHED" | "LIVE" | "ENDED" {
  if (status === EventStatus.ARCHIVED) return "ENDED";
  if (status === EventStatus.LIVE) return "LIVE";
  if (status === EventStatus.PUBLISHED) return "PUBLISHED";
  return "DRAFT";
}

function splitLocation(location: string | null | undefined): {
  city?: string;
  venue?: string;
} {
  if (!location) return {};
  const parts = location.split("·").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { city: parts[0], venue: parts.slice(1).join(" · ") };
  }
  return { venue: location };
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export async function getEventDashboardMobile(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      org: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoUrl: true,
          isVerified: true,
        },
      },
    },
  });

  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const participant = await findParticipantForUser(eventId, userId);
  const locationParts = splitLocation(event.location);

  const [meetings, attendeeCount, unreadNotificationCount] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        eventId,
        OR: [{ hostUserId: userId }, { guestUserId: userId }],
        startsAt: { gte: startOfToday(), lte: endOfToday() },
        status: { not: MeetingStatus.DECLINED },
      },
      orderBy: { startsAt: "asc" },
      include: {
        hostUser: { include: { profile: true } },
        guestUser: { include: { profile: true } },
      },
    }),
    prisma.participant.count({ where: { eventId } }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const todaySchedule = meetings.map((meeting) =>
    mapMeetingToScheduleItem(meeting, userId, new Set()),
  );

  const org: ApiEventOrg | null = event.org
    ? {
        id: event.org.id,
        name: event.org.name,
        slug: event.org.slug,
        logo_url: event.org.logoUrl,
        is_verified: event.org.isVerified,
      }
    : null;

  return {
    event: {
      id: event.id,
      name: event.name,
      event_type: event.type,
      starts_at: event.startDate?.toISOString() ?? new Date().toISOString(),
      ends_at: event.endDate?.toISOString() ?? new Date().toISOString(),
      city: locationParts.city,
      venue: locationParts.venue ?? event.location ?? undefined,
      status: mapEventStatus(event.status),
      org,
    },
    participant: participant
      ? {
          id: participant.id,
          name: participant.name,
          badge_qr: participant.badgeQr ?? "",
          company: participant.company ?? undefined,
        }
      : {
          id: `guest-${userId}`,
          name: "参会者",
          badge_qr: "",
        },
    aiRecommendations: [],
    recommendationTotal: 0,
    todaySchedule,
    activeInteraction: null,
    activeLottery: null,
    communityPosts: [],
    unreadNotificationCount,
    attendeeCount,
  };
}
