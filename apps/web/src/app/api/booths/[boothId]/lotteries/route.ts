import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createBoothLottery,
  listBoothLotteries,
} from "@/lib/lottery/booth-lottery-service";
import { createBoothLotterySchema } from "@/lib/lottery/booth-lottery-schemas";

import { requireBoothAccessForRequest } from "@/lib/mobile-exhibitor-service";

export const GET = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccessForRequest(request, boothId);
  const lotteries = await listBoothLotteries(boothId);

  return createSuccessResponse(lotteries, { total: lotteries.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireBoothAccessForRequest(request, boothId);
  const body = await request.json().catch(() => ({}));
  const parsed = createBoothLotterySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const result = await createBoothLottery(boothId, session, parsed.data);

  return createSuccessResponse(result);
});
