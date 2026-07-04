import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  refreshScreenPairingToken,
  serializeScreenPairingDetailed,
} from "@/lib/screen-pairing/service";
import { buildQrContent } from "@/lib/screen-pairing/shared";

export const POST = withErrorHandler(async (_request, context) => {
  const token = context?.params?.token?.trim();
  if (!token) {
    throw new ApiError("缺少 pairing token", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await refreshScreenPairingToken(token);

  if (result.kind === "paired") {
    const detailed = await serializeScreenPairingDetailed(result.record);
    return createSuccessResponse(detailed);
  }

  return createSuccessResponse({
    pairingToken: result.record.pairingToken,
    qrContent: buildQrContent(result.record.pairingToken),
    expiresIn: result.expiresIn,
  });
});
