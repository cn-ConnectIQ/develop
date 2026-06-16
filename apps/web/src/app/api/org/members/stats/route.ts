import {
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { getOrgMemberStats } from "@/lib/org-member-service";

export const GET = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const stats = await getOrgMemberStats(auth.orgId);
  return createSuccessResponse(stats);
});
