import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getMobileBoothFormConfig,
  patchMobileBoothFormCustomFields,
} from "@/lib/booth-form-config-service";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";

export const GET = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const data = await getMobileBoothFormConfig(boothId);

  return createSuccessResponse(data);
});

export const PATCH = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const body = await request.json().catch(() => null);
  const customFields =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).customFields
      : undefined;

  const data = await patchMobileBoothFormCustomFields(boothId, customFields);

  return createSuccessResponse(data);
});
