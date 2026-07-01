import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { getBoothInteractionResults } from "@/lib/exhibitor/booth-interaction-service";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";

export const GET = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  const sessionId = context?.params?.id;
  if (!boothId || !sessionId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const results = await getBoothInteractionResults(boothId, sessionId);
  return createSuccessResponse(results);
});
