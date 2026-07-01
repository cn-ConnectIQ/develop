import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getBoothInteractionSession,
  patchBoothInteraction,
} from "@/lib/exhibitor/booth-interaction-service";
import { patchBoothInteractionSchema } from "@/lib/interaction/schemas";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";

export const GET = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  const sessionId = context?.params?.id;
  if (!boothId || !sessionId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const item = await getBoothInteractionSession(boothId, sessionId);
  return createSuccessResponse(item);
});

export const PATCH = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  const sessionId = context?.params?.id;
  if (!boothId || !sessionId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const body = await request.json();
  const parsed = patchBoothInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const updated = await patchBoothInteraction(boothId, sessionId, parsed.data);
  return createSuccessResponse(updated);
});
