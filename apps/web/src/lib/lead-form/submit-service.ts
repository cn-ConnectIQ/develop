import {
  LotteryEntrySource,
  LotteryStatus,
  prisma,
  SignalType,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import {
  computeLeadAiIntentLevel,
  type AiIntentLevel,
} from "@/lib/exhibitor/lead-intent-service";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import { recordSignal } from "@/lib/signals";
import { isLotteryOpenForEntry } from "@/lib/lottery/booth-lottery-service";
import { normalizeLeadFormConfig } from "./normalize";
import { validateLeadFormEntries } from "./validate";
import type { LeadFormField, LeadFormSubmitBody, LeadFormSubmitResult } from "./types";

function extractCoreProfile(
  fields: LeadFormField[],
  values: Record<string, string>,
): {
  name?: string;
  phone?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
} {
  const profile: {
    name?: string;
    phone?: string;
    email?: string;
    company?: string;
    jobTitle?: string;
  } = {};

  for (const field of fields) {
    const value = values[field.id]?.trim();
    if (!value) continue;

    if (field.prefill_from === "user.name" || (field.type === "text" && field.label.includes("姓名"))) {
      profile.name ??= value;
    } else if (field.prefill_from === "user.phone" || field.type === "phone") {
      profile.phone ??= value;
    } else if (field.type === "email") {
      profile.email ??= value;
    } else if (field.prefill_from === "user.company" || field.label.includes("公司")) {
      profile.company ??= value;
    } else if (field.prefill_from === "user.title" || field.label.includes("职位")) {
      profile.jobTitle ??= value;
    }
  }

  return profile;
}

function inferIntentGradeFromForm(
  fields: LeadFormField[],
  values: Record<string, string>,
): AiIntentLevel {
  const highIntent = /有意向|高意向|立即|强烈|urgent/i;
  for (const field of fields) {
    if (field.type !== "select" && field.type !== "multiselect") continue;
    const value = values[field.id] ?? "";
    if (highIntent.test(value)) return "A";
  }

  const profile = extractCoreProfile(fields, values);
  if (profile.phone && profile.company) return "B";
  if (profile.phone || profile.email) return "B";
  return "C";
}

function buildLeadNotes(
  lotteryId: string,
  fields: LeadFormField[],
  values: Record<string, string>,
): string {
  return JSON.stringify({
    source: "lottery_lead_form",
    lottery_id: lotteryId,
    form_data: values,
    fields: fields.map((field) => ({
      field_id: field.id,
      label: field.label,
      type: field.type,
      value: values[field.id] ?? "",
    })),
  });
}

export async function submitLeadForm(
  userId: string,
  input: LeadFormSubmitBody,
): Promise<LeadFormSubmitResult> {
  const lottery = await prisma.lottery.findUnique({
    where: { id: input.lottery_id },
    include: {
      booth: { select: { id: true, eventId: true } },
    },
  });

  if (!lottery) {
    throw new ApiError("抽奖不存在", ErrorCode.NOT_FOUND, 404);
  }

  if (
    !isLotteryOpenForEntry(lottery.status) &&
    lottery.status !== LotteryStatus.DRAWING
  ) {
    throw new ApiError("抽奖未开放参与", ErrorCode.VALIDATION_ERROR, 400);
  }

  const boothId = lottery.boothId;
  if (!boothId) {
    throw new ApiError("该抽奖未关联展位，无法留资", ErrorCode.VALIDATION_ERROR, 400);
  }

  const config = normalizeLeadFormConfig(lottery.leadFormConfig);
  if (config.fields.length === 0) {
    throw new ApiError("未配置留资表单", ErrorCode.VALIDATION_ERROR, 400);
  }

  const values = validateLeadFormEntries(config.fields, input.entries);
  const eventId = lottery.eventId;
  const leadData = {
    entries: input.entries,
    values,
    submitted_at: new Date().toISOString(),
  };

  const participant = await ensureParticipantForUser(eventId, userId);
  if (!participant) {
    throw new ApiError("无法创建参会者记录", ErrorCode.VALIDATION_ERROR, 400);
  }

  const profile = extractCoreProfile(config.fields, values);
  if (Object.keys(profile).length > 0) {
    await prisma.participant.update({
      where: { id: participant.id },
      data: {
        name: profile.name ?? participant.name,
        phone: profile.phone ?? participant.phone,
        email: profile.email ?? participant.email,
        company: profile.company ?? participant.company,
        jobTitle: profile.jobTitle ?? participant.jobTitle,
      },
    });
  }

  const formGrade = inferIntentGradeFromForm(config.fields, values);
  const notes = buildLeadNotes(lottery.id, config.fields, values);

  const existingLead = await prisma.lead.findFirst({
    where: { boothId, participantId: participant.id },
  });

  const lead = existingLead
    ? await prisma.lead.update({
        where: { id: existingLead.id },
        data: {
          notes,
          intentGrade: existingLead.intentGrade ?? formGrade,
        },
      })
    : await prisma.lead.create({
        data: {
          boothId,
          participantId: participant.id,
          notes,
          intentGrade: formGrade,
        },
      });

  const existingEntry = await prisma.lotteryEntry.findUnique({
    where: { lotteryId_userId: { lotteryId: lottery.id, userId } },
  });

  let entryId: string;

  if (existingEntry) {
    const updated = await prisma.lotteryEntry.update({
      where: { id: existingEntry.id },
      data: {
        leadData,
        leadId: lead.id,
      },
    });
    entryId = updated.id;
  } else {
    const created = await prisma.$transaction(async (tx) => {
      const entry = await tx.lotteryEntry.create({
        data: {
          lotteryId: lottery.id,
          userId,
          leadData,
          leadId: lead.id,
          source: LotteryEntrySource.MANUAL,
        },
      });
      await tx.lottery.update({
        where: { id: lottery.id },
        data: { entryCount: { increment: 1 } },
      });
      return entry;
    });
    entryId = created.id;
  }

  recordSignal(
    userId,
    eventId,
    SignalType.BOOTH_LEAD_CAPTURED,
    boothId,
    "BOOTH",
    { lottery_id: lottery.id, lead_id: lead.id, source: "lottery_lead_form" },
  );

  const { scheduleLeadMarketupSync } = await import("@/lib/marketup-sync");
  void scheduleLeadMarketupSync(lead.id, eventId);

  const updatedParticipant = await prisma.participant.findUnique({
    where: { id: participant.id },
    select: {
      name: true,
      company: true,
      jobTitle: true,
      email: true,
      phone: true,
    },
  });

  const aiLevel = await computeLeadAiIntentLevel(
    boothId,
    eventId,
    updatedParticipant ?? participant,
    lead.intentGrade,
  );

  return {
    entry_id: entryId,
    lead_id: lead.id,
    ai_intent_level: aiLevel,
  };
}
