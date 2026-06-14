import type { EventStatus, EventType } from "@connectiq/database";
import {
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  isAfter,
  isBefore,
  isWithinInterval,
} from "date-fns";
import { zhCN } from "date-fns/locale";

export type EventPhase = "live" | "today" | "upcoming" | "draft" | "ended";

export type EventCategory = "SUMMIT" | "EXPO" | "SALON" | "TRAINING";

export type EventListItem = {
  id: string;
  name: string;
  slug: string;
  type: EventType;
  status: EventStatus;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  coverUrl?: string | null;
  category?: EventCategory | null;
  _count?: {
    participants: number;
    checkIns?: number;
    ticketTypes?: number;
    polls?: number;
    sessions?: number;
  };
  readiness?: { completed: number; total: number };
};

export function getEventPhase(event: {
  status: EventStatus;
  startDate: Date | null;
  endDate: Date | null;
}): EventPhase {
  const now = new Date();

  if (event.status === "ARCHIVED") return "ended";
  if (event.status === "DRAFT") return "draft";

  if (event.startDate && event.endDate) {
    if (isWithinInterval(now, { start: event.startDate, end: event.endDate })) {
      return "live";
    }
    if (isBefore(now, event.startDate)) {
      const days = differenceInCalendarDays(event.startDate, now);
      return days === 0 ? "today" : "upcoming";
    }
    if (isAfter(now, event.endDate)) return "ended";
  }

  if (event.status === "PUBLISHED") return "upcoming";
  return "draft";
}

export function formatEventDateRange(
  start: Date | null,
  end: Date | null,
) {
  if (!start) return "日期待定";
  const startText = format(start, "yyyy年M月d日", { locale: zhCN });
  if (!end) return startText;
  const endText = format(end, "M月d日", { locale: zhCN });
  return `${startText} - ${endText}`;
}

export function formatElapsed(start: Date) {
  const minutes = differenceInMinutes(new Date(), start);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

/** 距目标时间剩余（用于「距活动结束」） */
export function formatTimeRemaining(end: Date) {
  const minutes = differenceInMinutes(end, new Date());
  if (minutes <= 0) return "已结束";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0) return `${hours}h ${mins}min`;
  return `${mins}min`;
}

export function slugify(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${Date.now().toString(36)}`;
}

export const eventTypeLabels: Record<EventType, string> = {
  CONFERENCE: "峰会",
  EXPO: "展会",
};

export const eventCategoryOptions: Array<{
  value: EventCategory;
  label: string;
  dbType: EventType;
  description: string;
}> = [
  { value: "SUMMIT", label: "峰会", dbType: "CONFERENCE", description: "大型行业会议" },
  { value: "EXPO", label: "展会", dbType: "EXPO", description: "展览展示活动" },
  { value: "SALON", label: "沙龙", dbType: "CONFERENCE", description: "小型闭门交流" },
  { value: "TRAINING", label: "培训", dbType: "CONFERENCE", description: "课程与工作坊" },
];

export const eventPhaseLabels: Record<EventPhase, string> = {
  live: "进行中",
  today: "今天",
  upcoming: "即将举行",
  draft: "筹备中",
  ended: "已结束",
};

const phaseSortOrder: Record<EventPhase, number> = {
  live: 0,
  today: 1,
  upcoming: 2,
  draft: 3,
  ended: 4,
};

export function sortEventsByPhase<
  T extends {
    status: EventStatus | string;
    startDate: Date | string | null;
    endDate: Date | string | null;
  },
>(events: T[]): T[] {
  return [...events].sort((a, b) => {
    const phaseA = getEventPhase({
      status: a.status as EventStatus,
      startDate: a.startDate ? new Date(a.startDate) : null,
      endDate: a.endDate ? new Date(a.endDate) : null,
    });
    const phaseB = getEventPhase({
      status: b.status as EventStatus,
      startDate: b.startDate ? new Date(b.startDate) : null,
      endDate: b.endDate ? new Date(b.endDate) : null,
    });
    const orderDiff = phaseSortOrder[phaseA] - phaseSortOrder[phaseB];
    if (orderDiff !== 0) return orderDiff;
    const startA = a.startDate ? new Date(a.startDate).getTime() : 0;
    const startB = b.startDate ? new Date(b.startDate).getTime() : 0;
    return startA - startB;
  });
}

export function computeEventReadiness(event: {
  name: string;
  status: EventStatus;
  location: string | null;
  description: string | null;
  startDate: Date | null;
  endDate: Date | null;
  _count?: {
    participants?: number;
    ticketTypes?: number;
    polls?: number;
    sessions?: number;
  };
}): { completed: number; total: number } {
  const checks = [
    event.name.trim().length >= 2,
    Boolean(event.startDate && event.endDate),
    Boolean(event.location?.trim()),
    Boolean(event.description?.trim()),
    (event._count?.ticketTypes ?? 0) > 0,
    (event._count?.participants ?? 0) > 0,
    event.status === "PUBLISHED",
    (event._count?.polls ?? 0) > 0,
    (event._count?.sessions ?? 0) > 0,
  ];
  return { completed: checks.filter(Boolean).length, total: checks.length };
}

export function categoryToDbType(category: EventCategory): EventType {
  const found = eventCategoryOptions.find((o) => o.value === category);
  return found?.dbType ?? "CONFERENCE";
}
