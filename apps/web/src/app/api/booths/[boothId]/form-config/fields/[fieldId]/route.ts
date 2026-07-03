import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  deleteMobileBoothFormField,
  updateMobileBoothFormField,
} from "@/lib/booth-form-config-service";
import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";

export const PATCH = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  const fieldId = context?.params?.fieldId;
  if (!boothId || !fieldId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const body = await request.json().catch(() => null);
  const data = await updateMobileBoothFormField(boothId, fieldId, body);

  return createSuccessResponse(data);
});

export const DELETE = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  const fieldId = context?.params?.fieldId;
  if (!boothId || !fieldId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const data = await deleteMobileBoothFormField(boothId, fieldId);

  return createSuccessResponse(data);
});
