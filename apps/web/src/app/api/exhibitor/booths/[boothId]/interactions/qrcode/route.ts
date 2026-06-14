import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireBoothAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { regenerateBoothInteractionQr } from "@/lib/exhibitor/booth-interaction-service";
import { regenerateBoothInteractionQrSchema } from "@/lib/interaction/schemas";

export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccess(boothId);
  const body = await request.json();
  const parsed = regenerateBoothInteractionQrSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await regenerateBoothInteractionQr(
    boothId,
    parsed.data.session_id,
  );

  return createSuccessResponse(result);
});
