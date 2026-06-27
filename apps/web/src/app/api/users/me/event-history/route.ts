import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { listMyEventHistoryWithSn } from "@/lib/sn-pairs-service";


export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const items = await listMyEventHistoryWithSn(userId);
  return createSuccessResponse(items);
});
