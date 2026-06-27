import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { fetchPointsRewards } from "@/lib/points-service";


export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const rewards = await fetchPointsRewards(userId);
  return createSuccessResponse({ rewards });
});
