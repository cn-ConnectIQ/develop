import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { adjustPlatformPoints, getPlatformPointsStats } from "@/lib/platform-data";

export const GET = withErrorHandler(async () => {
  await requirePlatformAdmin();
  const data = await getPlatformPointsStats();
  return createSuccessResponse(data);
});

const adjustSchema = z.object({
  userId: z.string(),
  amount: z.number(),
  reason: z.string().min(1),
});

/** @deprecated 请使用 POST /api/platform/points/adjust */
export const POST = withErrorHandler(async (request) => {
  await requirePlatformAdmin();
  const body = await request.json();
  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  await adjustPlatformPoints(
    parsed.data.userId,
    parsed.data.amount,
    parsed.data.reason,
  );

  return createSuccessResponse({
    ...parsed.data,
    type: "ADJUSTMENT",
    recorded: true,
  });
});
