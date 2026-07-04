import {
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  TOKEN_TTL_SECONDS,
  buildQrContent,
  createWaitingScreenPairing,
} from "@/lib/screen-pairing/service";

export const POST = withErrorHandler(async () => {
  const record = await createWaitingScreenPairing();

  return createSuccessResponse({
    pairingToken: record.pairingToken,
    qrContent: buildQrContent(record.pairingToken),
    expiresIn: TOKEN_TTL_SECONDS,
  });
});
