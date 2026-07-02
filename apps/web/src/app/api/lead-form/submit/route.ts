import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import {
  submitLeadFormForLottery,
} from "@/lib/lottery-attendee-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const submitSchema = z.object({
  lottery_id: z.string().cuid(),
  event_id: z.string().cuid(),
  booth_id: z.string().cuid().optional(),
  name: z.string().min(1).max(80),
  phone: z.string().min(6).max(20),
  company: z.string().max(120).optional(),
  title: z.string().max(80).optional(),
  form_data: z.record(z.string()).optional(),
});

/** 参会者 · 留资并参与抽奖 */
export const POST = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = await request.json();
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const disabled = await guardEventFeature(parsed.data.event_id, "lottery");
  if (disabled) return disabled;

  const result = await submitLeadFormForLottery(userId, parsed.data);
  return createSuccessResponse(result);
});
