export type DashboardStats = {
  participants: number;
  checkedIn: number;
  pending: number;
  checkInRate: number;
  connections: number;
  connectionsDelta: string;
  vipCheckedIn: number;
  vipTotal: number;
  vipRate: number;
  leads: number;
  leadsGradeA: number;
  leadsGradeB: number;
  leadsGradeC: number;
  meetings: {
    total: number;
    completed: number;
    inProgress: number;
    noShow: number;
  };
  hasLivePoll: boolean;
  livePollTitle: string | null;
  ticketTypeCount: number;
};

export type DashboardCheckinItem = {
  id: string;
  checkedInAt: Date;
  name: string;
  company: string | null;
  ticketType: string;
  isVip: boolean;
};

export type DashboardAlert = {
  id: string;
  message: string;
  href: string;
};
