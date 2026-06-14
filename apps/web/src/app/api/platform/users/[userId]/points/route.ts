import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { adjustPlatformPoints } from "@/lib/platform-data";

const schema = z.object({
  amount: z.number(),
  reason: z.string().min(1),
});

export const PATCH = withErrorHandler(async (request, context) => {
  await requirePlatformAdmin();
  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  await adjustPlatformPoints(userId, parsed.data.amount, parsed.data.reason);

  return createSuccessResponse({
    userId,
    adjustment: parsed.data,
    recorded: true,
  });
});
