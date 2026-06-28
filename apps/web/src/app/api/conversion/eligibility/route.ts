import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import type {
  ConversionHookContext,
  ConversionHookTrigger,
  ConversionTarget,
} from "@/lib/conversion-hook-config";
import { evaluateHookEligibility } from "@/lib/conversion-hook-service";

export const GET = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const target = searchParams.get("target") as ConversionTarget | null;
  const context = searchParams.get("context") as ConversionHookContext | null;
  const trigger = searchParams.get("trigger") as ConversionHookTrigger | null;
  const eventId = searchParams.get("eventId");
  const boothId = searchParams.get("boothId");

  if (!target || !context || !trigger) {
    return createErrorResponse("缺少参数", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await evaluateHookEligibility({
    userId: auth.session.user.id,
    orgId: auth.orgId,
    target,
    context,
    trigger,
    eventId,
    boothId,
  });

  return createSuccessResponse(result);
});
