import {
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listExhibitorLeads } from "@/lib/exhibitor/dashboard-service";
import { requireExhibitorAdmin } from "@/lib/exhibitor/exhibitor-auth";

export const GET = withErrorHandler(async (request) => {
  const { booth } = await requireExhibitorAdmin(request);
  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") ?? "8"), 1),
    50,
  );

  const leads = await listExhibitorLeads(booth.id, booth.eventId, limit);

  return createSuccessResponse({ leads, total: leads.length });
});
