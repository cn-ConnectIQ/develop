import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { listReferrals } from "@/lib/referrals-service";


export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") ?? "introducer";
  const limit = Number(searchParams.get("limit") ?? "20");

  if (role !== "introducer" && role !== "recipient") {
    return createErrorResponse("role 参数无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await listReferrals(userId, role, limit);
  return createSuccessResponse(result);
});
