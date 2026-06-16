import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getOrgPublicDetail,
  resolveOptionalUserId,
} from "@/lib/org-public-service";

export const GET = withErrorHandler(async (request, context) => {
  const { slug } = await context.params;
  if (!slug) {
    return createErrorResponse("缺少 slug", ErrorCode.BAD_REQUEST, 400);
  }

  try {
    const userId = await resolveOptionalUserId(request);
    const data = await getOrgPublicDetail(slug, userId ?? undefined);
    return createSuccessResponse(data);
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
