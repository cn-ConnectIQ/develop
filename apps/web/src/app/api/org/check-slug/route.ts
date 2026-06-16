import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { checkSlugAvailable } from "@/lib/org-profile-service";

export const GET = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const slug = new URL(request.url).searchParams.get("slug");
  if (!slug) {
    return createErrorResponse("缺少 slug 参数", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await checkSlugAvailable(slug, auth.orgId);
  return createSuccessResponse({
    available: result.available,
    slug: result.slug,
    reason: result.reason,
  });
});
