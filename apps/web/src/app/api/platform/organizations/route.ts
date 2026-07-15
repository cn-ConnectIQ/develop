import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { listPlatformOrganizations } from "@/lib/platform-organization-service";

export const GET = withErrorHandler(async (request) => {
  await requirePlatformAdmin();
  const { searchParams } = new URL(request.url);
  const data = await listPlatformOrganizations({
    search: searchParams.get("search") ?? undefined,
    status: searchParams.get("status") ?? undefined,
    page: Number(searchParams.get("page") ?? "1") || 1,
    pageSize: Number(searchParams.get("pageSize") ?? "20") || 20,
  });
  return createSuccessResponse(data);
});
