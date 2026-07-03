import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  performStaffBadgeCheckin,
  type StaffCheckinParticipant,
} from "@/lib/checkin-staff";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import { parseScanContent, resolveBadgeQr } from "@/lib/scan-parse";

export type ScanExecuteAction = "CHECKIN";

export type ScanExecuteStatus = "SUCCESS" | "DUPLICATE" | "INVALID";

export type ScanExecuteParticipantView = {
  id: string;
  name: string;
  company: string | null;
  avatar_url: string | null;
  is_vip: boolean;
};

export type ScanExecuteResult = {
  status: ScanExecuteStatus;
  action: ScanExecuteAction;
  participant?: ScanExecuteParticipantView;
  checked_in_at?: string;
  checked_in_time?: string;
  today_checked_in_count: number;
  message?: string;
};

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTimeHm(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function avatarSeedUrl(name: string): string {
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.slice(0, 1) || "?")}`;
}

async function countTodayCheckins(eventId: string): Promise<number> {
  return prisma.checkIn.count({
    where: {
      eventId,
      checkedInAt: { gte: startOfToday() },
    },
  });
}

function mapParticipantView(
  participant: StaffCheckinParticipant,
  avatarUrl?: string | null,
): ScanExecuteParticipantView {
  return {
    id: participant.id,
    name: participant.name,
    company: participant.company,
    avatar_url: avatarUrl ?? avatarSeedUrl(participant.name),
    is_vip: participant.is_vip,
  };
}

/** 将 CIQ: 参会码解析为可用于签到的标识 */
async function resolveCheckinContent(
  eventId: string,
  rawCode: string,
): Promise<string | null> {
  const trimmed = rawCode.trim();
  if (!trimmed) return null;

  const ciqMatch = trimmed.match(/^CIQ:(.+)$/i);
  if (ciqMatch) {
    const redemptionCode = ciqMatch[1]!.trim();
    const redemption = await prisma.userEventCode.findFirst({
      where: { eventId, code: redemptionCode },
      select: { userId: true },
    });
    if (!redemption) return null;

    const participant = await findParticipantForUser(eventId, redemption.userId);
    if (!participant) return null;
    return participant.badgeQr ?? participant.id;
  }

  const parsed = parseScanContent(trimmed);
  return resolveBadgeQr(parsed);
}

export async function executeScanCheckin(
  eventId: string,
  rawCode: string,
): Promise<ScanExecuteResult> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    throw new ApiError("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const checkinContent = await resolveCheckinContent(eventId, rawCode);
  if (!checkinContent) {
    return {
      status: "INVALID",
      action: "CHECKIN",
      today_checked_in_count: await countTodayCheckins(eventId),
      message: "无效的码，请确认",
    };
  }

  try {
    const result = await performStaffBadgeCheckin(eventId, checkinContent);
    const todayCount = await countTodayCheckins(eventId);
    const checkedAt = new Date(result.checked_in_at);

    const participant = mapParticipantView(result.participant);

    if (result.already_checked_in) {
      return {
        status: "DUPLICATE",
        action: "CHECKIN",
        participant,
        checked_in_at: result.checked_in_at,
        checked_in_time: formatTimeHm(checkedAt),
        today_checked_in_count: todayCount,
        message: `已签到 · ${formatTimeHm(checkedAt)}`,
      };
    }

    return {
      status: "SUCCESS",
      action: "CHECKIN",
      participant,
      checked_in_at: result.checked_in_at,
      checked_in_time: formatTimeHm(checkedAt),
      today_checked_in_count: todayCount,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return {
        status: "INVALID",
        action: "CHECKIN",
        today_checked_in_count: await countTodayCheckins(eventId),
        message: "无效的码，请确认",
      };
    }
    throw err;
  }
}

export async function getScanCheckinStats(eventId: string) {
  return {
    today_checked_in_count: await countTodayCheckins(eventId),
  };
}
