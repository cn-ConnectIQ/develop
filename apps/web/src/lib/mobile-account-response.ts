import type { ApiAccountOverview, ApiAccountEventItem } from "@/lib/account-mobile-service";

/** 小程序 account/overview 双写 snake_case */
export function toMobileAccountOverview(data: ApiAccountOverview) {
  return {
    ...data,
    total_events: data.totalEvents,
    total_participants: data.totalParticipants,
    total_leads: data.totalLeads,
    total_connections: data.totalConnections,
    events_by_type: data.eventsByType,
  };
}

/** 小程序 account/events 列表项双写 snake_case + snapshot */
export function toMobileAccountEventItem(item: ApiAccountEventItem) {
  return {
    ...item,
    activity_type: item.activityType,
    starts_at: item.startsAt,
    ends_at: item.endsAt,
    checkin_rate: item.checkinRate,
    on_site: item.onSite,
    connections: item.connections,
    snapshot: {
      checkin_rate: item.checkinRate,
      on_site: item.onSite,
      connections: item.connections,
    },
  };
}
