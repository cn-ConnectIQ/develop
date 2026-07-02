import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireBoothAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createBoothLottery,
  listBoothLotteries,
} from "@/lib/lottery/booth-lottery-service";
import { createBoothLotterySchema } from "@/lib/lottery/booth-lottery-schemas";

export const GET = withErrorHandler(async (_request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireBoothAccess(boothId);
  const lotteries = await listBoothLotteries(boothId);

  return createSuccessResponse(lotteries, { total: lotteries.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireBoothAccess(boothId);
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
