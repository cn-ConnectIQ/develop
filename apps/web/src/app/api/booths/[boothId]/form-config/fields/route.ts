import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { createMobileBoothFormField } from "@/lib/booth-form-config-service";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";

export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const body = await request.json().catch(() => null);
  const data = await createMobileBoothFormField(boothId, body);

  return createSuccessResponse(data);
});
