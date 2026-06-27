import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { fetchMeIntents } from "@/lib/user-me-service";


export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const intents = await fetchMeIntents(userId);
  return createSuccessResponse({ intents });
});
