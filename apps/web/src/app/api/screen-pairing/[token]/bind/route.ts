import { InteractionType } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  ScreenPairingExpiredError,
  bindScreenPairing,
  requireScreenPairingBindOperator,
} from "@/lib/screen-pairing/service";

const bodySchema = z.object({
  eventId: z.string().min(1),
  interactionType: z.enum(["POLL", "LOTTERY", "QA"]),
  interactionId: z.string().min(1),
  interactionName: z.string().min(1),
});

function mapInteractionType(type: "POLL" | "LOTTERY" | "QA"): InteractionType {
  if (type === "LOTTERY") return InteractionType.LOTTERY;
  if (type === "QA") return InteractionType.QA;
  return InteractionType.POLL;
}

export const POST = withErrorHandler(async (request, context) => {
  const token = context?.params?.token?.trim();
  if (!token) {
    return createErrorResponse("缺少配对码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const operator = await requireScreenPairingBindOperator(request, parsed.data.eventId);

  try {
    const result = await bindScreenPairing({
      token,
      userId: operator.userId,
      role: operator.role,
      eventId: parsed.data.eventId,
      interactionType: mapInteractionType(parsed.data.interactionType),
      interactionId: parsed.data.interactionId,
      interactionName: parsed.data.interactionName,
    });

    return createSuccessResponse({
      paired: true,
      screenOnline: true,
      pairingToken: result.record.pairingToken,
      interactionType: parsed.data.interactionType,
      interactionName: result.interactionName,
    });
  } catch (err) {
    if (err instanceof ScreenPairingExpiredError) {
      return createErrorResponse(
        "二维码已过期,请刷新浏览器重新扫码",
        ErrorCode.VALIDATION_ERROR,
        410,
      );
    }
    throw err;
  }
});
