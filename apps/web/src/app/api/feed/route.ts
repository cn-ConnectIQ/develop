import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { listFeedItems } from "@/lib/feed-service";


export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? "1");
  const limit = Number(searchParams.get("limit") ?? "20");
  const cursor = searchParams.get("cursor");

  const result = await listFeedItems(userId, { page, limit, cursor });

  return createSuccessResponse(result.data, result.meta);
});
