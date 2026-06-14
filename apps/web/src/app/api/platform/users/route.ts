import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { getPlatformUsers } from "@/lib/platform-data";

export const GET = withErrorHandler(async (request) => {
  await requirePlatformAdmin();
  const url = new URL(request.url);
  const data = await getPlatformUsers({
    search: url.searchParams.get("search") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 20),
  });
  return createSuccessResponse({
    users: data.users,
    total: data.total,
    page: data.page,
    pageSize: data.pageSize,
  });
});
