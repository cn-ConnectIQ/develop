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
  createStampRally,
  listEventBoothsForRally,
  listStampRallies,
} from "@/lib/stamp-rally-service";

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  prize: z.string().min(1).max(500),
  prize_image_url: z.string().optional().nullable(),
  required_count: z.number().int().min(1),
  booth_ids: z.array(z.string().min(1)).min(1),
  starts_at: z.string().datetime().optional().nullable(),
  ends_at: z.string().datetime().optional().nullable(),
  status: z.nativeEnum(StampRallyStatus).optional(),
});

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const { searchParams } = new URL(request.url);
  if (searchParams.get("include") === "booths") {
    const booths = await listEventBoothsForRally(eventId);
    return createSuccessResponse({ booths });
  }

  const rallies = await listStampRallies(eventId);
  return createSuccessResponse({ rallies });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const rally = await createStampRally(eventId, session.user.id, {
    name: parsed.data.name,
    description: parsed.data.description,
    prize: parsed.data.prize,
    prize_image_url: parsed.data.prize_image_url,
    required_count: parsed.data.required_count,
    booth_ids: parsed.data.booth_ids,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at,
    status: parsed.data.status,
  });

  return createSuccessResponse(rally);
});
