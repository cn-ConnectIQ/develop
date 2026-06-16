import { AccountType, ApplicationStatus } from "@connectiq/database";
import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { fetchPlatformApplications } from "@/lib/platform-application-service";

export const GET = withErrorHandler(async (request) => {
  await requirePlatformAdmin();
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "ALL";
  const typeParam = url.searchParams.get("type") ?? "ALL";
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 20);

  const status =
    statusParam === "ALL" ? "ALL" : (statusParam as ApplicationStatus);
  const accountType =
    typeParam === "ALL" ? "ALL" : (typeParam as AccountType);

  const data = await fetchPlatformApplications({
    status,
    accountType,
    page,
    pageSize,
  });

  return createSuccessResponse(data);
});
