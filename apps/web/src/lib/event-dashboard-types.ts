import type {
  DashboardAlert,
  DashboardInsights,
  DashboardStats,
} from "@/lib/dashboard-types";
import type { EventPhase } from "@/lib/event-utils";

/** API / SSR 活动工作台数据（JSON 可序列化，不含 Prisma 枚举） */
export type EventDashboardCheckinItem = {
  id: string;
  checkedInAt: string;
  name: string;
  company: string | null;
  ticketType: string;
  isVip: boolean;
};

export type EventDashboardPayload = {
  event: {
    id: string;
    name: string;
    phase: EventPhase;
    reviewStatus: string | null;
    review: {
      status: string;
      revisionNotes: string | null;
      rejectionReason: string | null;
    } | null;
    startDate: string | null;
    endDate: string | null;
  };
  stats: DashboardStats;
  insights: DashboardInsights | null;
  recentCheckIns: EventDashboardCheckinItem[];
  alerts: DashboardAlert[];
};
