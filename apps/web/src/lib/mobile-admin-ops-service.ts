import {
  LotteryStatus,
  StampRallyStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { broadcastToEvent } from "@/lib/live-ops-service";
import {
  drawLotteryWinners,
  getLotteryOrThrow,
} from "@/lib/interaction/lottery-service";

export async function assertOrgEvent(orgId: string, eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true, name: true, activityType: true },
  });
  if (!event) {
    throw new ApiError("活动不存在或无权访问", ErrorCode.NOT_FOUND, 404);
  }
  return event;
}

export async function sendMobileEventBroadcast(
  orgId: string,
  eventId: string,
  input: { title?: string; body: string; urgent?: boolean },
) {
  await assertOrgEvent(orgId, eventId);
  const title = input.title?.trim() || "活动通知";
  const body = input.body.trim();
  if (!body) {
    throw new ApiError("请输入推送内容", ErrorCode.VALIDATION_ERROR, 400);
  }
  return broadcastToEvent(eventId, { title, body, urgent: input.urgent });
}

export async function listPendingExhibitorReviews(eventId: string, orgId: string) {
  await assertOrgEvent(orgId, eventId);
  const rows = await prisma.exhibitorBooth.findMany({
    where: { eventId, operatorUserId: null },
    select: {
      id: true,
      code: true,
      name: true,
      companyOrg: { select: { name: true } },
    },
    orderBy: { code: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    company_name: row.companyOrg.name,
    booth_code: row.code,
    booth_name: row.name,
    status: "PENDING" as const,
  }));
}

export async function reviewExhibitorBooth(
  orgId: string,
  eventId: string,
  boothId: string,
  action: "approve" | "reject",
) {
  await assertOrgEvent(orgId, eventId);
  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
    include: { companyOrg: { select: { ownerId: true } } },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (action === "approve") {
    const operatorUserId = booth.companyOrg.ownerId;
    await prisma.exhibitorBooth.update({
      where: { id: boothId },
      data: {
        status: "BOOKED",
        ...(operatorUserId ? { operatorUserId } : {}),
      },
    });
    return { id: boothId, status: "APPROVED" as const };
  }

  await prisma.exhibitorBooth.update({
    where: { id: boothId },
    data: { status: "AVAILABLE" },
  });
  return { id: boothId, status: "REJECTED" as const };
}

export async function getEventStampMonitor(orgId: string, eventId: string) {
  await assertOrgEvent(orgId, eventId);

  const rally = await prisma.stampRally.findFirst({
    where: { eventId, status: StampRallyStatus.ACTIVE },
    orderBy: { updatedAt: "desc" },
  });

  const participantTotal = await prisma.participant.count({ where: { eventId } });
  const boothIds = rally?.boothIds ?? [];

  if (boothIds.length === 0) {
    const booths = await prisma.exhibitorBooth.findMany({
      where: { eventId },
      select: { id: true, code: true, companyOrg: { select: { name: true } } },
      take: 12,
    });
    return {
      completion_rate: 0,
      booths: booths.map((b) => ({
        booth_id: b.id,
        label: `${b.code} ${b.companyOrg.name}`,
        stamp_count: 0,
        target_audience: participantTotal,
      })),
    };
  }

  const stampCounts = await prisma.stampRecord.groupBy({
    by: ["boothId"],
    where: { rallyId: rally!.id, boothId: { in: boothIds } },
    _count: { id: true },
  });
  const countMap = new Map(stampCounts.map((r) => [r.boothId, r._count.id]));

  const booths = await prisma.exhibitorBooth.findMany({
    where: { id: { in: boothIds } },
    select: { id: true, code: true, companyOrg: { select: { name: true } } },
  });

  const items = booths.map((b) => ({
    booth_id: b.id,
    label: `${b.code} ${b.companyOrg.name}`,
    stamp_count: countMap.get(b.id) ?? 0,
    target_audience: participantTotal,
  }));

  const completedUsers = rally
    ? await prisma.stampRallyWinner.count({ where: { rallyId: rally.id } })
    : 0;
  const completion_rate =
    participantTotal > 0 ? Math.round((completedUsers / participantTotal) * 100) : 0;

  return { completion_rate, booths: items };
}

export async function listAdminDrawLotteries(orgId: string, eventId: string) {
  await assertOrgEvent(orgId, eventId);
  const lotteries = await prisma.lottery.findMany({
    where: {
      eventId,
      status: { in: [LotteryStatus.OPEN, LotteryStatus.DRAWING, LotteryStatus.DRAFT] },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      booth: { select: { code: true, companyOrg: { select: { name: true } } } },
      _count: { select: { entries: true } },
    },
  });

  return lotteries.map((lottery) => ({
    id: lottery.id,
    title: lottery.title,
    status: lottery.status,
    entry_count: lottery._count.entries,
    booth_label: lottery.booth
      ? `${lottery.booth.companyOrg.name} · ${lottery.booth.code}`
      : undefined,
  }));
}

export async function adminDrawLottery(
  orgId: string,
  eventId: string,
  lotteryId: string,
  prizeRank = 1,
  count = 1,
) {
  await assertOrgEvent(orgId, eventId);
  await getLotteryOrThrow(eventId, lotteryId);
  const winners = await drawLotteryWinners(eventId, lotteryId, prizeRank, count);
  return { winners, count: winners.length };
}

export async function listAdminEventLeads(
  orgId: string,
  eventId: string,
  limit = 50,
) {
  await assertOrgEvent(orgId, eventId);
  const leads = await prisma.lead.findMany({
    where: { booth: { eventId } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      participant: {
        select: { name: true, company: true, jobTitle: true },
      },
      booth: {
        select: { code: true, companyOrg: { select: { name: true } } },
      },
    },
  });

  return leads.map((lead) => ({
    id: lead.id,
    name: lead.participant.name,
    company: lead.participant.company,
    title: lead.participant.jobTitle,
    intent_level: lead.intentGrade ?? "C",
    booth_code: lead.booth.code,
    booth_company: lead.booth.companyOrg.name,
    crm_status: mapCrmStatus(lead.crmSyncStatus),
    captured_at: lead.createdAt.toISOString(),
  }));
}

function mapCrmStatus(status: string): "SYNCED" | "PENDING" | "FAILED" {
  if (status === "SYNCED") return "SYNCED";
  if (status === "FAILED") return "FAILED";
  return "PENDING";
}

export async function exportAdminLeadsMarketUp(orgId: string, eventId: string) {
  await assertOrgEvent(orgId, eventId);
  const leads = await prisma.lead.findMany({
    where: {
      booth: { eventId },
      crmSyncStatus: { in: ["PENDING", "FAILED"] },
    },
    select: { id: true },
  });

  const { scheduleLeadMarketupSync } = await import("@/lib/marketup-sync");
  await Promise.allSettled(
    leads.map((lead) => scheduleLeadMarketupSync(lead.id, eventId)),
  );

  return {
    task_id: `export-${eventId}-${Date.now()}`,
    status: "QUEUED" as const,
    lead_count: leads.length,
    message:
      leads.length > 0
        ? `已触发 ${leads.length} 条线索同步至 MarketUP`
        : "所有线索已同步，无需导出",
  };
}

export async function createAdminEventLead(
  orgId: string,
  eventId: string,
  input: {
    visitor_user_id: string;
    name?: string;
    company?: string;
    title?: string;
    intent_track?: string;
    intent_level: "A" | "B" | "C";
    note?: string;
    ai_grade_reason?: string;
    booth_id?: string;
  },
) {
  await assertOrgEvent(orgId, eventId);

  const { ensureParticipantForUser } = await import(
    "@/lib/interaction/participant-user"
  );
  const participant = await ensureParticipantForUser(
    eventId,
    input.visitor_user_id,
  );
  if (!participant) {
    throw new ApiError("访客不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (input.name || input.company) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        ...(input.name ? { name: input.name } : {}),
        ...(input.company ? { company: input.company } : {}),
        ...(input.title ? { jobTitle: input.title } : {}),
      },
    });
  }

  let boothId = input.booth_id;
  if (!boothId) {
    throw new ApiError(
      "请指定展位后再采集线索",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
    select: { id: true },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const noteParts = [
    input.intent_track ? `意向赛道：${input.intent_track}` : null,
    input.ai_grade_reason ? `AI 评级：${input.ai_grade_reason}` : null,
    input.note ?? null,
  ].filter(Boolean);

  const lead = await prisma.lead.create({
    data: {
      boothId,
      participantId: participant.id,
      intentGrade: input.intent_level,
      notes: noteParts.length > 0 ? noteParts.join("\n") : null,
    },
  });

  const { scheduleLeadMarketupSync } = await import("@/lib/marketup-sync");
  void scheduleLeadMarketupSync(lead.id, eventId);

  const { recordSignal } = await import("@/lib/signals");
  const { SignalType } = await import("@connectiq/database");
  recordSignal(
    input.visitor_user_id,
    eventId,
    SignalType.BOOTH_LEAD_CAPTURED,
    boothId,
    "BOOTH",
    { intent_level: input.intent_level, source: "admin_scan" },
  );

  return {
    id: lead.id,
    intent_level: input.intent_level,
  };
}
