import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getExhibitorLeadDetail,
  patchExhibitorLeadGrade,
} from "@/lib/exhibitor/dashboard-service";
import { requireExhibitorAdmin } from "@/lib/exhibitor/exhibitor-auth";

const patchSchema = z.object({
  intent_grade: z.enum(["A", "B", "C"]),
});

export const GET = withErrorHandler(async (request, context) => {
  const leadId = context?.params?.id;
  if (!leadId) {
    return createErrorResponse("缺少线索 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { booth } = await requireExhibitorAdmin(request);
  const detail = await getExhibitorLeadDetail(booth.id, booth.eventId, leadId);

  if (!detail) {
    return createErrorResponse("线索不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(detail);
});

export const PATCH = withErrorHandler(async (request, context) => {
  const leadId = context?.params?.id;
  if (!leadId) {
    return createErrorResponse("缺少线索 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { booth } = await requireExhibitorAdmin(request);
  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const updated = await patchExhibitorLeadGrade(
    booth.id,
    leadId,
    parsed.data.intent_grade,
  );

  if (!updated) {
    return createErrorResponse("线索不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({
    id: updated.id,
    intent_grade: updated.intentGrade,
    ai_intent_level: updated.intentGrade,
  });
});
