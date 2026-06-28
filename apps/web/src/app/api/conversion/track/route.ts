import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import type {
  ConversionHookAction,
  ConversionHookContext,
  ConversionHookTrigger,
} from "@/lib/conversion-hook-config";
import { trackConversionHook } from "@/lib/conversion-hook-service";

const bodySchema = z.object({
  target: z.enum(["BAGEVENT", "MARKETUP"]),
  context: z.enum([
    "event_report_summary",
    "excel_import",
    "exhibitor_dashboard",
    "exhibitor_leads_list",
    "exhibitor_leads_export",
    "exhibitor_ai_buyers",
    "marketup_sync_visible",
  ]),
  trigger: z.enum([
    "first_event_completed",
    "manual_excel_import",
    "lead_threshold",
    "export_click",
    "ai_buyer_view",
    "crm_data_synced",
  ]),
  action: z.enum(["shown", "clicked", "dismissed", "converted"]),
  eventId: z.string().optional(),
  boothId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const POST = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin();
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const row = await trackConversionHook({
    userId: auth.session.user.id,
    orgId: auth.orgId,
    target: parsed.data.target,
    context: parsed.data.context as ConversionHookContext,
    trigger: parsed.data.trigger as ConversionHookTrigger,
    action: parsed.data.action as ConversionHookAction,
    eventId: parsed.data.eventId,
    boothId: parsed.data.boothId,
    metadata: parsed.data.metadata,
  });

  return createSuccessResponse({ id: row.id });
});
