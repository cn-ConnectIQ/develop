import {
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getSnHeatmapData } from "@/lib/sn-heatmap-service";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) throw new Error("缺少活动 ID");
  await requireEventAccess(eventId);
  const data = await getSnHeatmapData(eventId);
  return createSuccessResponse(data);
});
