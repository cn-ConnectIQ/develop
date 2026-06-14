import { prisma, type Prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { buildExcelExport, buildPdfBuffer } from "@/lib/report-export";
import type { ReportTabId } from "@/lib/report-types";
import { getEventReportSummary } from "@/lib/reports";
import { randomBytes } from "crypto";

const bodySchema = z.object({
  format: z.enum(["pdf", "excel"]),
  tabs: z
    .array(
      z.enum([
        "connections",
        "checkin",
        "interactions",
        "booths",
        "matching",
        "meetings",
      ]),
    )
    .min(1)
    .optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const report = await getEventReportSummary(eventId);
  if (!report) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const tabs: ReportTabId[] = parsed.data.tabs ?? [
    "connections",
    "checkin",
    "interactions",
    "booths",
    "matching",
    "meetings",
  ];

  const safeName = report.event.name.replace(/[^\w\u4e00-\u9fff-]+/g, "_");

  if (parsed.data.format === "excel") {
    const buffer = buildExcelExport(report, tabs);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}_report.xlsx"`,
      },
    });
  }

  const buffer = buildPdfBuffer(report, tabs);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}_report.html"`,
    },
  });
});

export const shareSettingKey = (eventId: string) =>
  `report_share_${eventId}`;

export const PUT = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: shareSettingKey(eventId) } },
    create: {
      eventId,
      key: shareSettingKey(eventId),
      value: { token, expiresAt: expiresAt.toISOString() } as Prisma.InputJsonValue,
    },
    update: {
      value: { token, expiresAt: expiresAt.toISOString() } as Prisma.InputJsonValue,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const shareUrl = `${baseUrl}/events/${eventId}/reports?share=${token}`;

  return createSuccessResponse({ shareUrl, expiresAt: expiresAt.toISOString() });
});
