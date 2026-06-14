import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireBoothAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createBoothInteraction,
  listBoothInteractions,
} from "@/lib/exhibitor/booth-interaction-service";
import { createBoothInteractionSchema } from "@/lib/interaction/schemas";

export const GET = withErrorHandler(async (_request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccess(boothId);
  const interactions = await listBoothInteractions(boothId);

  return createSuccessResponse(interactions, { total: interactions.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session, booth } = await requireBoothAccess(boothId);
  const body = await request.json();
  const parsed = createBoothInteractionSchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await createBoothInteraction(
    { id: booth.id, eventId: booth.eventId },
    session,
    parsed.data,
  );

  return createSuccessResponse(result);
});
