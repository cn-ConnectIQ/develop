import {
  NotificationJobStatus,
  prisma,
} from "@connectiq/database";
import { countActivatedParticipants } from "@/lib/notification/audience";
import { createNotificationJob, dispatchNotificationJob } from "@/lib/notification/job-service";
import { notifyUser } from "@/lib/notification/notification-service";
import { seedNotificationTemplates } from "@/lib/notification/seed-templates";

/**
 * 定时触发入口：ATT-05 / ORG-01 / 闭幕报告 ATT-16 · EXH-06 · ORG-04
 * 由 Cron（对标 cron-invite-send）调用 /api/cron/notification-triggers
 */
export async function runNotificationTriggers(now = new Date()) {
  await seedNotificationTemplates().catch(() => undefined);

  const events = await prisma.event.findMany({
    where: {
      status: { in: ["LIVE", "PUBLISHED"] },
      startDate: { not: null },
      endDate: { not: null },
    },
    select: {
      id: true,
      orgId: true,
      name: true,
      shortName: true,
      startDate: true,
      endDate: true,
      organizerId: true,
    },
    take: 200,
  });

  const results: Array<{ eventId: string; action: string; detail?: string }> = [];
  const dayMs = 24 * 60 * 60 * 1000;

  for (const event of events) {
    if (!event.startDate || !event.endDate) continue;
    const start = event.startDate.getTime();
    const end = event.endDate.getTime();
    const t = now.getTime();

    // ATT-05：开幕前约 24h，未启用
    if (start - t > 20 * 60 * 60 * 1000 && start - t < 28 * 60 * 60 * 1000) {
      const existing = await prisma.notificationJob.findFirst({
        where: {
          eventId: event.id,
          templateCode: "ATT-05",
          createdAt: { gte: new Date(t - dayMs) },
        },
      });
      if (!existing && event.shortName) {
        try {
          const job = await createNotificationJob({
            eventId: event.id,
            orgId: event.orgId,
            createdById: event.organizerId,
            templateCode: "ATT-05",
            audienceFilter: { type: "not_activated" },
            variableOverrides: {
              已启用人数: await countActivatedParticipants(event.id),
            },
          });
          await prisma.notificationJob.update({
            where: { id: job.id },
            data: {
              complianceConfirmedAt: now,
              complianceConfirmedById: event.organizerId,
              sampleTestedAt: now,
              status: NotificationJobStatus.SCHEDULED,
            },
          });
          await dispatchNotificationJob({
            jobId: job.id,
            eventId: event.id,
            orgId: event.orgId,
          });
          results.push({ eventId: event.id, action: "ATT-05" });
        } catch (e) {
          results.push({
            eventId: event.id,
            action: "ATT-05",
            detail: e instanceof Error ? e.message : "failed",
          });
        }
      }
    }

    // ORG-01：开幕前 3 天内每日
    const daysToStart = (start - t) / dayMs;
    if (daysToStart > 0 && daysToStart <= 3.2) {
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const existing = await prisma.notificationJob.findFirst({
        where: {
          eventId: event.id,
          templateCode: "ORG-01",
          createdAt: { gte: todayStart },
        },
      });
      if (!existing) {
        try {
          const total = await prisma.participant.count({
            where: { eventId: event.id },
          });
          const activated = await countActivatedParticipants(event.id);
          const intentCount = await prisma.userEventIntent.count({
            where: { eventId: event.id },
          });
          const rate = total ? Math.round((activated / total) * 100) : 0;
          await notifyUser({
            userId: event.organizerId,
            templateCode: "ORG-01",
            eventId: event.id,
            payload: {
              D: Math.max(1, Math.ceil(daysToStart)),
              X: rate,
              已启用人数: activated,
              总人数: total,
              Y: intentCount,
            },
            skipQuota: true,
            targetUrl: `${process.env.NEXT_PUBLIC_APP_URL}/events/${event.id}`,
          });
          results.push({ eventId: event.id, action: "ORG-01" });
        } catch (e) {
          results.push({
            eventId: event.id,
            action: "ORG-01",
            detail: e instanceof Error ? e.message : "failed",
          });
        }
      }
    }

    // 闭幕当晚：结束日后 0–12h
    if (t >= end && t - end < 12 * 60 * 60 * 1000) {
      for (const code of ["ATT-16", "EXH-06", "ORG-04"] as const) {
        const existing = await prisma.notificationJob.findFirst({
          where: { eventId: event.id, templateCode: code },
        });
        if (existing) continue;
        try {
          if (code === "ORG-04") {
            const total = await prisma.participant.count({
              where: { eventId: event.id },
            });
            const activated = await countActivatedParticipants(event.id);
            const connections = await prisma.businessConnection.count({
              where: { eventId: event.id },
            });
            await notifyUser({
              userId: event.organizerId,
              templateCode: "ORG-04",
              eventId: event.id,
              payload: {
                X: total ? Math.round((activated / total) * 100) : 0,
                已启用人数: activated,
                总人数: total,
                N: connections,
                M: 0,
                K: 0,
                区域: "—",
              },
              skipQuota: true,
            });
          } else {
            const audience =
              code === "EXH-06"
                ? ({ type: "all_exhibitors" } as const)
                : ({ type: "all_attendees", confirm_all_attendees_sms: true } as const);
            const job = await createNotificationJob({
              eventId: event.id,
              orgId: event.orgId,
              createdById: event.organizerId,
              templateCode: code,
              audienceFilter: audience,
            });
            await prisma.notificationJob.update({
              where: { id: job.id },
              data: {
                complianceConfirmedAt: now,
                complianceConfirmedById: event.organizerId,
                sampleTestedAt: now,
              },
            });
            await dispatchNotificationJob({
              jobId: job.id,
              eventId: event.id,
              orgId: event.orgId,
            });
          }
          results.push({ eventId: event.id, action: code });
        } catch (e) {
          results.push({
            eventId: event.id,
            action: code,
            detail: e instanceof Error ? e.message : "failed",
          });
        }
      }
    }
  }

  return results;
}
