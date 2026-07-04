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
  expiredPairingResponse,
  getScreenPairingByToken,
  requireScreenPairingBindOperator,
} from "@/lib/screen-pairing/service";

const bindSchema = z.object({
  eventId: z.string().min(1),
  interactionType: z.enum(["POLL", "LOTTERY", "QA"]),
  interactionId: z.string().min(1),
  interactionName: z.string().optional(),
});

export const POST = withErrorHandler(async (request, context) => {
  const token = context?.params?.token?.trim();
  if (!token) {
    return createErrorResponse("缺少 pairing token", ErrorCode.VALIDATION_ERROR, 400);
  }

  const raw = await request.json().catch(() => null);
  const parsed = bindSchema.safeParse(raw);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数校验失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const { eventId, interactionType, interactionId, interactionName } = parsed.data;

  await getScreenPairingByToken(token);

  const { userId, role } = await requireScreenPairingBindOperator(request, eventId);

  try {
    const result = await bindScreenPairing({
      token,
      userId,
      role,
      eventId,
      interactionType: interactionType as InteractionType,
      interactionId,
      interactionName: interactionName?.trim() ?? "",
    });

    return createSuccessResponse({
      paired: result.paired,
      eventName: result.eventName,
      interactionName: result.interactionName,
    });
  } catch (err) {
    if (err instanceof ScreenPairingExpiredError) {
      return expiredPairingResponse();
    }
    throw err;
  }
});
