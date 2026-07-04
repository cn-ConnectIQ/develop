import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { broadcastScreenPairingMessage } from "@/lib/screen-pairing/realtime";
import {
  buildQrContent,
  resetScreenPairing,
  serializeScreenPairing,
} from "@/lib/screen-pairing/service";

export const POST = withErrorHandler(async (_request, context) => {
  const token = context?.params?.token?.trim();
  if (!token) {
    return createErrorResponse("缺少 pairing token", ErrorCode.VALIDATION_ERROR, 400);
  }

  const record = await resetScreenPairing(token);

  await broadcastScreenPairingMessage(record.pairingToken, {
    type: "RESET",
    data: { pairingToken: record.pairingToken },
  });

  return createSuccessResponse({
    ...serializeScreenPairing(record),
    qrContent: buildQrContent(record.pairingToken),
  });
});
