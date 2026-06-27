import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { fetchUserPointsOverview } from "@/lib/points-service";


export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "30");

  const overview = await fetchUserPointsOverview(userId, limit);
  return createSuccessResponse(overview);
});
