export type ReportEvent = {
  id: string;
  name: string;
  location: string | null;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  phase: "ended" | "live";
};

export type ConnectionsReport = {
  total: number;
  avgPerPerson: number;
  buyerSellerPairs: number;
  buyerSellerRate: number;
  vsHistory: string;
  timeline: Array<{ hour: string; total: number }>;
  sources: Array<{ name: string; value: number }>;
  topNodes: Array<{
    rank: number;
    name: string;
    company: string;
    connections: number;
    source: string;
    avatarInitial: string;
  }>;
};

export type CheckinReport = {
  total: number;
  participants: number;
  rate: number;
  byHour: Array<{ hour: string; count: number }>;
  vipRate: number;
  absent: Array<{ name: string; company: string | null; email: string | null }>;
};

export type InteractionsReport = {
  polls: Array<{ id: string; title: string; responses: number; rate: number }>;
  totalResponses: number;
  satisfaction: number;
  topQuestions: Array<{ rank: number; question: string; votes: number }>;
};

export type BoothsReport = {
  exhibitors: Array<{ name: string; code: string; leads: number }>;
  intentDistribution: { A: number; B: number; C: number };
  marketupSyncRate: number;
  syncSummary: Array<{
    boothCode: string;
    boothName: string;
    total: number;
    synced: number;
    rate: number;
  }>;
};

export type MatchingReport = {
  participationRate: number;
  completionRate: number;
  connectionsMade: number;
  pairs: Array<{
    userA: string;
    userB: string;
    score: number;
    ratingA: number;
    ratingB: number;
    connected: boolean;
  }>;
};

export type MeetingsReport = {
  funnel: Array<{ stage: string; count: number }>;
  aiSlotAdoption: number;
  ratingDistribution: Array<{ score: string; left: number; right: number }>;
};

export type EventReportSummary = {
  event: ReportEvent;
  aiSummary: string;
  connections: ConnectionsReport;
  checkin: CheckinReport;
  interactions: InteractionsReport;
  booths: BoothsReport;
  matching: MatchingReport;
  meetings: MeetingsReport;
};

export type ReportTabId =
  | "connections"
  | "checkin"
  | "interactions"
  | "booths"
  | "matching"
  | "meetings";

export const REPORT_TAB_LABELS: Record<ReportTabId, string> = {
  connections: "连接报告",
  checkin: "签到报告",
  interactions: "互动报告",
  booths: "展位报告",
  matching: "配对报告",
  meetings: "会面报告",
};
