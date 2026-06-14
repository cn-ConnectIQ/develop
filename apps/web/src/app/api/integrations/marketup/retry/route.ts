import { ErrorCode, UserRole } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { retryMarketupSync } from "@/lib/marketup-sync";

const retrySchema = z.object({
  jobId: z.string().optional(),
  leadId: z.string().optional(),
});

export const POST = withErrorHandler(async (request) => {
  await requireAuth([UserRole.PLATFORM_ADMIN, UserRole.ORGANIZER]);

  const body = await request.json();
  const parsed = retrySchema.safeParse(body);
  if (!parsed.success || (!parsed.data.jobId && !parsed.data.leadId)) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    const result = await retryMarketupSync(
      parsed.data.jobId,
      parsed.data.leadId,
    );
    return createSuccessResponse(result);
  } catch (error) {
    return createErrorResponse(
      error instanceof Error ? error.message : "重试失败",
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }
});
