import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { stampBooth } from "@/lib/stamp-rally-service";

const bodySchema = z.object({
  booth_id: z.string().min(1),
});


export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const rallyId = context?.params?.rallyId;
  if (!eventId || !rallyId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await stampBooth(
    eventId,
    rallyId,
    userId,
    parsed.data.booth_id,
  );

  return createSuccessResponse(result);
});
