import { EventStatus, prisma, type Prisma } from "@connectiq/database";
import { getBaigeEventSyncStatus } from "@/lib/integrations/baige-sync";
import type {
  ConversionHookAction,
  ConversionHookContext,
  ConversionHookTrigger,
  ConversionHookVars,
  ConversionTarget,
} from "@/lib/conversion-hook-config";
import { hookIdentityKey } from "@/lib/conversion-hook-config";
import { getEventPhase } from "@/lib/event-utils";

export type TrackHookInput = {
  userId: string;
  orgId?: string | null;
  target: ConversionTarget;
  context: ConversionHookContext;
  trigger: ConversionHookTrigger;
  action: ConversionHookAction;
  eventId?: string | null;
  boothId?: string | null;
  metadata?: Record<string, unknown>;
};

export type HookEligibilityInput = {
  userId: string;
  orgId?: string | null;
  target: ConversionTarget;
  context: ConversionHookContext;
  trigger: ConversionHookTrigger;
  eventId?: string | null;
  boothId?: string | null;
};

export async function trackConversionHook(input: TrackHookInput) {
  return prisma.conversionHookEvent.create({
    data: {
      userId: input.userId,
      orgId: input.orgId ?? null,
      target: input.target,
      context: input.context,
      trigger: input.trigger,
      action: input.action,
      eventId: input.eventId ?? null,
      boothId: input.boothId ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function isHookDismissed(
  userId: string,
  target: ConversionTarget,
  context: ConversionHookContext,
  trigger: ConversionHookTrigger,
) {
  const dismissed = await prisma.conversionHookEvent.findFirst({
    where: {
      userId,
      target,
      context,
      trigger,
      action: "dismissed",
    },
    select: { id: true },
  });
  return !!dismissed;
}

export async function evaluateHookEligibility(
  input: HookEligibilityInput,
): Promise<{ show: boolean; vars: ConversionHookVars; reason?: string }> {
  const dismissed = await isHookDismissed(
    input.userId,
    input.target,
    input.context,
    input.trigger,
  );
  if (dismissed) {
    return { show: false, vars: {}, reason: "dismissed" };
  }

  if (input.target === "BAGEVENT") {
    if (input.eventId) {
      const baige = await getBaigeEventSyncStatus(input.eventId);
      if (baige.baigeEventId && baige.lastSyncAt) {
        return { show: false, vars: {}, reason: "already_using_baige" };
      }
    }
    return evaluateBaigeHook(input);
  }

  return evaluateMarketupHook(input);
}

async function evaluateBaigeHook(input: HookEligibilityInput) {
  if (!input.orgId) {
    return { show: false, vars: {}, reason: "no_org" };
  }

  if (input.trigger === "first_event_completed" && input.eventId) {
    const event = await prisma.event.findUnique({
      where: { id: input.eventId },
      include: {
        _count: { select: { participants: true } },
      },
    });
    if (!event || event.orgId !== input.orgId) {
      return { show: false, vars: {}, reason: "event_not_found" };
    }

    const phase = getEventPhase({
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
    });
    if (phase !== "ended") {
      return { show: false, vars: {}, reason: "event_not_ended" };
    }

    const endedCount = await prisma.event.count({
      where: {
        orgId: input.orgId,
        OR: [
          { status: EventStatus.ARCHIVED },
          { endDate: { lt: new Date() } },
        ],
      },
    });
    if (endedCount < 1) {
      return { show: false, vars: {}, reason: "no_completed_event" };
    }

    const connectionCount = await prisma.businessConnection.count({
      where: { eventId: input.eventId },
    });

    return {
      show: true,
      vars: {
        participantCount: event._count.participants,
        connectionCount,
      },
    };
  }

  if (input.trigger === "manual_excel_import") {
    return { show: true, vars: {} };
  }

  return { show: false, vars: {}, reason: "trigger_not_met" };
}

async function evaluateMarketupHook(input: HookEligibilityInput) {
  if (input.trigger === "crm_data_synced") {
    if (input.eventId) {
      const synced = await prisma.lead.count({
        where: {
          crmSyncStatus: "SYNCED",
          booth: { eventId: input.eventId },
        },
      });
      if (synced < 1) {
        return { show: false, vars: {}, reason: "no_synced_leads" };
      }
      return { show: true, vars: { syncedLeadCount: synced } };
    }

    if (!input.orgId) {
      return { show: false, vars: {}, reason: "no_org" };
    }
    const synced = await prisma.lead.count({
      where: {
        crmSyncStatus: "SYNCED",
        booth: { companyOrgId: input.orgId },
      },
    });
    if (synced < 1) {
      return { show: false, vars: {}, reason: "no_synced_leads" };
    }
    return { show: true, vars: { syncedLeadCount: synced } };
  }

  if (!input.boothId) {
    return { show: false, vars: {}, reason: "no_booth" };
  }

  const leads = await prisma.lead.findMany({
    where: { boothId: input.boothId },
    select: {
      intentGrade: true,
      intentTags: { include: { intentTag: { select: { label: true } } } },
    },
  });

  const gradeFromLead = (grade: string | null, tags: string[]) => {
    if (grade === "A" || tags.some((t) => /采购|投资|A/i.test(t))) return "A";
    if (grade === "B") return "B";
    return "C";
  };

  let gradeA = 0;
  let gradeB = 0;
  let gradeC = 0;
  for (const lead of leads) {
    const tags = lead.intentTags.map((t) => t.intentTag.label);
    const g = gradeFromLead(lead.intentGrade, tags);
    if (g === "A") gradeA++;
    else if (g === "B") gradeB++;
    else gradeC++;
  }

  const vars: ConversionHookVars = {
    leadCount: leads.length,
    gradeA,
    gradeB,
    gradeC,
  };

  if (input.trigger === "lead_threshold") {
    if (leads.length < 3) {
      return { show: false, vars, reason: "lead_threshold_not_met" };
    }
    return { show: true, vars };
  }

  if (input.trigger === "export_click") {
    if (leads.length < 1) {
      return { show: false, vars, reason: "no_leads" };
    }
    return { show: true, vars };
  }

  if (input.trigger === "ai_buyer_view") {
    return { show: true, vars };
  }

  return { show: false, vars, reason: "trigger_not_met" };
}

export async function getConversionHooksStats(orgId?: string | null) {
  const where = orgId ? { orgId } : {};

  const rows = await prisma.conversionHookEvent.groupBy({
    by: ["target", "context", "trigger", "action"],
    where,
    _count: { _all: true },
  });

  type Bucket = {
    target: string;
    context: string;
    trigger: string;
    shown: number;
    clicked: number;
    dismissed: number;
    converted: number;
    clickRate: number;
  };

  const map = new Map<string, Bucket>();

  for (const row of rows) {
    const key = hookIdentityKey(
      row.target as ConversionTarget,
      row.context as ConversionHookContext,
      row.trigger as ConversionHookTrigger,
    );
    const bucket =
      map.get(key) ??
      ({
        target: row.target,
        context: row.context,
        trigger: row.trigger,
        shown: 0,
        clicked: 0,
        dismissed: 0,
        converted: 0,
        clickRate: 0,
      } satisfies Bucket);

    const action = row.action as ConversionHookAction;
    if (action === "shown") bucket.shown = row._count._all;
    if (action === "clicked") bucket.clicked = row._count._all;
    if (action === "dismissed") bucket.dismissed = row._count._all;
    if (action === "converted") bucket.converted = row._count._all;

    map.set(key, bucket);
  }

  const hooks = [...map.values()].map((bucket) => ({
    ...bucket,
    clickRate:
      bucket.shown > 0
        ? Math.round((bucket.clicked / bucket.shown) * 1000) / 10
        : 0,
  }));

  hooks.sort((a, b) => b.clicked - a.clicked);

  return {
    hooks,
    totals: {
      shown: hooks.reduce((s, h) => s + h.shown, 0),
      clicked: hooks.reduce((s, h) => s + h.clicked, 0),
      dismissed: hooks.reduce((s, h) => s + h.dismissed, 0),
      converted: hooks.reduce((s, h) => s + h.converted, 0),
    },
  };
}
