import { ErrorCode } from "@connectiq/types";
import { NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  exportEventConnectionsCsv,
  getEventConnectionAnalytics,
} from "@/lib/connection-analytics-service";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("export") === "csv") {
    const csv = await exportEventConnectionsCsv(eventId);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="connections-${eventId}.csv"`,
      },
    });
  }

  const data = await getEventConnectionAnalytics(eventId);
  return createSuccessResponse(data);
});
