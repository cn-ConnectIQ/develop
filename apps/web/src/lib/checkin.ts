import type { CheckinHourlyBucket } from "@/lib/checkin-types";

export function buildHourlyBuckets(
  checkIns: { checkedInAt: Date }[],
  eventStartHour = 9,
  eventEndHour = 18,
): CheckinHourlyBucket[] {
  const buckets: Record<number, number> = {};

  for (let h = eventStartHour; h <= eventEndHour; h++) {
    buckets[h] = 0;
  }

  for (const checkIn of checkIns) {
    const hour = checkIn.checkedInAt.getHours();
    buckets[hour] = (buckets[hour] ?? 0) + 1;
  }

  const activeHours = checkIns.map((c) => c.checkedInAt.getHours());
  const minHour =
    activeHours.length > 0
      ? Math.min(eventStartHour, ...activeHours)
      : eventStartHour;
  const maxHour =
    activeHours.length > 0
      ? Math.max(eventEndHour, ...activeHours)
      : eventEndHour;

  const result: CheckinHourlyBucket[] = [];
  for (let h = minHour; h <= maxHour; h++) {
    result.push({
      hour: `${String(h).padStart(2, "0")}:00`,
      count: buckets[h] ?? 0,
    });
  }

  if (result.length === 0) {
    return [
      { hour: "09:00", count: 0 },
      { hour: "10:00", count: 0 },
      { hour: "11:00", count: 0 },
      { hour: "12:00", count: 0 },
    ];
  }

  return result;
}

export function calcCheckinRate(checkedIn: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((checkedIn / total) * 1000) / 10;
}
