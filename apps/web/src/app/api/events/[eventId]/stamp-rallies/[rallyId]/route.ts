import { StampRallyStatus } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getStampRally,
  updateStampRally,
} from "@/lib/stamp-rally-service";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  prize: z.string().min(1).max(500).optional(),
  prize_image_url: z.string().optional().nullable(),
  required_count: z.number().int().min(1).optional(),
  booth_ids: z.array(z.string().min(1)).min(1).optional(),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(StampRallyStatus).optional(),
});

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const rallyId = context?.params?.rallyId;
  if (!eventId || !rallyId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const rally = await getStampRally(eventId, rallyId);
  if (!rally) {
    return createErrorResponse("集章路线不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(rally);
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const rallyId = context?.params?.rallyId;
  if (!eventId || !rallyId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const rally = await updateStampRally(eventId, rallyId, parsed.data);
  return createSuccessResponse(rally);
});
