import { ExperienceAccountStatus } from "@connectiq/database";
import {
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { fetchPlatformExperienceAccounts } from "@/lib/experience/experience-account-service";

export const GET = withErrorHandler(async (request) => {
  await requirePlatformAdmin();
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") ?? "ALL";
  const page = Number(url.searchParams.get("page") ?? 1);
  const pageSize = Number(url.searchParams.get("pageSize") ?? 20);

  const status =
    statusParam === "ALL"
      ? "ALL"
      : (statusParam as ExperienceAccountStatus);

  const data = await fetchPlatformExperienceAccounts({ status, page, pageSize });
  return createSuccessResponse(data);
});
