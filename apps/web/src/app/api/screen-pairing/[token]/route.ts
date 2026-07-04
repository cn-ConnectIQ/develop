import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getScreenPairingByToken,
  markWaitingExpiredIfNeeded,
  serializeScreenPairingDetailed,
} from "@/lib/screen-pairing/service";

export const GET = withErrorHandler(async (_request, context) => {
  const token = context?.params?.token?.trim();
  if (!token) {
    throw new ApiError("缺少 pairing token", ErrorCode.VALIDATION_ERROR, 400);
  }

  let record = await getScreenPairingByToken(token);
  record = await markWaitingExpiredIfNeeded(record);

  return createSuccessResponse(await serializeScreenPairingDetailed(record));
});
