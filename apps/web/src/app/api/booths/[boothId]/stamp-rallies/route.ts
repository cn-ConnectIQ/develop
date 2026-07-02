import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireBoothAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { upsertBoothStampRallySchema } from "@/lib/stamp/booth-stamp-rally-schemas";
import {
  listBoothStampRallies,
  upsertBoothStampRally,
} from "@/lib/stamp/booth-stamp-rally-service";

export const GET = withErrorHandler(async (_request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccess(boothId);
  const rallies = await listBoothStampRallies(boothId);

  return createSuccessResponse({ rallies }, { total: rallies.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireBoothAccess(boothId);
  const body = await request.json().catch(() => ({}));
  const parsed = upsertBoothStampRallySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const rally = await upsertBoothStampRally(boothId, session, parsed.data);

  return createSuccessResponse(rally);
});
