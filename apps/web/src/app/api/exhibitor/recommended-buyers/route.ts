import {
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listRecommendedBuyers } from "@/lib/exhibitor/dashboard-service";
import {
  requireExhibitorAdmin,
  resolveExhibitorOperatorUserId,
} from "@/lib/exhibitor/exhibitor-auth";

export const GET = withErrorHandler(async () => {
  const { booth } = await requireExhibitorAdmin();
  const exhibitorUserId = await resolveExhibitorOperatorUserId(booth.id);
  const buyers = await listRecommendedBuyers(
    booth.id,
    booth.eventId,
    exhibitorUserId,
    5,
  );

  const pendingCount = buyers.filter((b) => b.pending_contact).length;

  return createSuccessResponse({
    buyers,
    pending_contact_count: pendingCount,
  });
});
