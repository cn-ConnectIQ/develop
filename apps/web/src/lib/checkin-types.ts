export type CheckinStats = {
  checkedIn: number;
  total: number;
  rate: number;
  vipCheckedIn: number;
  vipTotal: number;
  speakerCheckedIn: number;
  speakerTotal: number;
  todayNew: number;
};

export type CheckinHourlyBucket = {
  hour: string;
  count: number;
};

export type CheckinFeedItem = {
  id: string;
  checkedInAt: string;
  name: string;
  company: string | null;
  ticketType: string;
  isVip?: boolean;
};

export type VipStatusItem = {
  id: string;
  name: string;
  company: string | null;
  ticketType: string;
  checkedIn: boolean;
  checkedInAt: string | null;
};

export type CheckinDashboardData = {
  event: { id: string; name: string };
  stats: CheckinStats;
  hourly: CheckinHourlyBucket[];
  recent: CheckinFeedItem[];
  vipList: VipStatusItem[];
};
