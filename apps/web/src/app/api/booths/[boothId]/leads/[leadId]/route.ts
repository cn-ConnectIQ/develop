import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireBoothAccess,
  withErrorHandler,
} from "@/lib/api-auth";

const patchLeadSchema = z.object({
  status: z
    .enum(["NEW", "CONTACTED", "QUALIFIED", "LOST", "WON"])
    .optional(),
  notes: z.string().max(2000).nullable().optional(),
});

function serializeLead(lead: Awaited<ReturnType<typeof loadLead>>) {
  if (!lead) return null;
  return {
    id: lead.id,
    status: lead.status,
    intent_grade: lead.intentGrade,
    notes: lead.notes,
    crm_sync_status: lead.crmSyncStatus,
    crm_sync_error: lead.crmSyncError,
    crm_synced_at: lead.crmSyncedAt?.toISOString() ?? null,
    marketup_contact_id: lead.marketupContactId,
    marketup_lead_id: lead.marketupLeadId,
    created_at: lead.createdAt.toISOString(),
    updated_at: lead.updatedAt.toISOString(),
    participant: {
      name: lead.participant.name,
      company: lead.participant.company,
      email: lead.participant.email,
      phone: lead.participant.phone,
      job_title: lead.participant.jobTitle,
    },
    intent_tags: lead.intentTags.map((t) => ({
      id: t.intentTag.id,
      label: t.intentTag.label,
    })),
  };
}

async function loadLead(boothId: string, leadId: string) {
  return prisma.lead.findFirst({
    where: { id: leadId, boothId },
    include: {
      participant: {
        select: {
          name: true,
          company: true,
          email: true,
          phone: true,
          jobTitle: true,
        },
      },
      intentTags: {
        include: { intentTag: { select: { id: true, label: true } } },
      },
    },
  });
}

export const GET = withErrorHandler(async (_request, context) => {
  const boothId = context?.params?.boothId;
  const leadId = context?.params?.leadId;
  if (!boothId || !leadId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccess(boothId);
  const lead = await loadLead(boothId, leadId);
  if (!lead) {
    return createErrorResponse("线索不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(serializeLead(lead));
});

export const PATCH = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  const leadId = context?.params?.leadId;
  if (!boothId || !leadId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { booth } = await requireBoothAccess(boothId);
  const existing = await loadLead(boothId, leadId);
  if (!existing) {
    return createErrorResponse("线索不存在", ErrorCode.NOT_FOUND, 404);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = patchLeadSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (parsed.data.status === undefined && parsed.data.notes === undefined) {
    return createErrorResponse("无更新内容", ErrorCode.VALIDATION_ERROR, 400);
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(parsed.data.status !== undefined
        ? { status: parsed.data.status }
        : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    },
    include: {
      participant: {
        select: {
          name: true,
          company: true,
          email: true,
          phone: true,
          jobTitle: true,
        },
      },
      intentTags: {
        include: { intentTag: { select: { id: true, label: true } } },
      },
    },
  });

  if (
    parsed.data.status !== undefined &&
    parsed.data.status !== existing.status
  ) {
    const { scheduleLeadMarketupSync } = await import("@/lib/marketup-sync");
    void scheduleLeadMarketupSync(updated.id, booth.eventId);
  }

  return createSuccessResponse(serializeLead(updated));
});
