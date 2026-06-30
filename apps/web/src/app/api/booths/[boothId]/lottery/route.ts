import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  drawBoothInstantLottery,
  type BoothLotteryLeadInput,
} from "@/lib/interaction/lottery-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const leadSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
});

/** 展位即时抽奖 */
export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = leadSchema.safeParse(body);
  const lead: BoothLotteryLeadInput | undefined = parsed.success
    ? parsed.data
    : undefined;

  const result = await drawBoothInstantLottery(boothId, userId, lead);
  return createSuccessResponse(result);
});
