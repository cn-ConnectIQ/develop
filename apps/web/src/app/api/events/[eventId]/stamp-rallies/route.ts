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
  deriveBoothIdsFromInput,
  stampPointSchema,
} from "@/lib/stamp/stamp-rally-schemas";
import {
  createStampRally,
  listEventBoothsForRally,
  listStampRallies,
} from "@/lib/stamp-rally-service";

const createSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional().nullable(),
    cover_image: z.string().optional().nullable(),
    prize: z.string().min(1).max(500),
    prize_image_url: z.string().optional().nullable(),
    prize_desc: z.string().max(2000).optional().nullable(),
    prize_quantity: z.number().int().positive().optional().nullable(),
    required_count: z.number().int().min(1),
    booth_ids: z.array(z.string().min(1)).optional(),
    booth_stamps: z.array(stampPointSchema).min(1).optional(),
    starts_at: z.string().datetime().optional().nullable(),
    ends_at: z.string().datetime().optional().nullable(),
    always_open: z.boolean().optional(),
    status: z.nativeEnum(StampRallyStatus).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.booth_stamps?.length && !data.booth_ids?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请至少添加一个打卡点",
        path: ["booth_stamps"],
      });
    }
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

  const boothStamps = parsed.data.booth_stamps;
  const boothIds = deriveBoothIdsFromInput(boothStamps ?? [], parsed.data.booth_ids);

  const rally = await createStampRally(eventId, session.user.id, {
    name: parsed.data.name,
    description: parsed.data.description,
    cover_image: parsed.data.cover_image,
    prize: parsed.data.prize,
    prize_image_url: parsed.data.prize_image_url,
    prize_desc: parsed.data.prize_desc,
    prize_quantity: parsed.data.prize_quantity,
    required_count: parsed.data.required_count,
    booth_ids: boothIds,
    booth_stamps: boothStamps,
    starts_at: parsed.data.starts_at,
    ends_at: parsed.data.ends_at,
    always_open: parsed.data.always_open,
    status: parsed.data.status,
  });

  return createSuccessResponse(rally);
});
