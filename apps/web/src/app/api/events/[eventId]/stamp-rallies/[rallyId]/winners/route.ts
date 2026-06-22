import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  listStampRallyWinners,
  redeemStampRallyWinner,
} from "@/lib/stamp-rally-service";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const rallyId = context?.params?.rallyId;
  if (!eventId || !rallyId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const winners = await listStampRallyWinners(eventId, rallyId);

  return createSuccessResponse({ winners });
});

const patchSchema = z.object({
  winner_id: z.string().cuid(),
  redeemed: z.boolean(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const rallyId = context?.params?.rallyId;
  if (!eventId || !rallyId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  await redeemStampRallyWinner(
    eventId,
    rallyId,
    parsed.data.winner_id,
    parsed.data.redeemed,
  );

  return createSuccessResponse({ updated: true });
});
