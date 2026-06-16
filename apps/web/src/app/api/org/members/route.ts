import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { listOrgMembers } from "@/lib/org-member-service";

export const GET = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
  const search = url.searchParams.get("search") ?? undefined;
  const source = url.searchParams.get("source") ?? "all";
  const tier = url.searchParams.get("tier") ?? "all";
  const eventId = url.searchParams.get("event_id") ?? "all";
  const tagsParam = url.searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").filter(Boolean) : undefined;

  const result = await listOrgMembers(auth.orgId, {
    page,
    pageSize,
    search,
    source,
    tier,
    eventId,
    tags,
  });

  return createSuccessResponse(
    {
      items: result.items,
      orgEvents: result.orgEvents,
      orgTags: result.orgTags,
    },
    {
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    },
  );
});
