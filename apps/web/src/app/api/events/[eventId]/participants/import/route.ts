import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { generateBadgeQr } from "@/lib/participants";

const importSchema = z.object({
  rows: z.array(
    z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
    }),
  ),
  skipDuplicates: z.boolean().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("导入数据格式错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of parsed.data.rows) {
    if (!row.phone?.trim()) {
      skipped++;
      continue;
    }

    const phone = row.phone.trim();
    const existing = await prisma.participant.findFirst({
      where: { eventId, phone },
    });

    if (existing) {
      if (parsed.data.skipDuplicates) {
        skipped++;
        continue;
      }
      await prisma.participant.update({
        where: { id: existing.id },
        data: {
          name: row.name,
          company: row.company ?? existing.company,
          email: row.email ?? existing.email,
          jobTitle: row.jobTitle ?? existing.jobTitle,
          badgeQr: existing.badgeQr ?? generateBadgeQr(eventId),
        },
      });
      updated++;
    } else {
      await prisma.participant.create({
        data: {
          eventId,
          name: row.name,
          phone,
          email: row.email ?? null,
          company: row.company ?? null,
          jobTitle: row.jobTitle ?? null,
          badgeQr: generateBadgeQr(eventId),
        },
      });
      created++;
    }
  }

  return createSuccessResponse({ created, updated, skipped });
});
