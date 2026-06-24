import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { upsertParticipantsFromRows } from "@/lib/participant-import-service";

const importSchema = z.object({
  rows: z.array(
    z.object({
      name: z.string().min(1),
      phone: z.string().optional(),
      email: z.string().optional(),
      company: z.string().optional(),
      jobTitle: z.string().optional(),
    }),
  ),
  skipDuplicates: z.boolean().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json();
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("导入数据格式错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await upsertParticipantsFromRows(
    eventId,
    parsed.data.rows,
    { skipDuplicates: parsed.data.skipDuplicates },
  );

  return createSuccessResponse(result);
});
