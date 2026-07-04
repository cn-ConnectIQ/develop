import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  isScreenOnline,
  touchScreenPairingHeartbeat,
} from "@/lib/screen-pairing/service";

export const POST = withErrorHandler(async (_request, context) => {
  const token = context?.params?.token?.trim();
  if (!token) {
    return createErrorResponse("缺少 pairing token", ErrorCode.VALIDATION_ERROR, 400);
  }

  const record = await touchScreenPairingHeartbeat(token);

  return createSuccessResponse({
    ok: true,
    screenOnline: isScreenOnline(record.lastHeartbeatAt),
    lastHeartbeatAt: record.lastHeartbeatAt?.toISOString() ?? null,
  });
});
