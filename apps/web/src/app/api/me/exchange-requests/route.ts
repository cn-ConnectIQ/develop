import { ErrorCode } from "@connectiq/types";
import { ExchangeStatus } from "@connectiq/database";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { listMyExchangeRequests } from "@/lib/exchange-request-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

export const GET = withErrorHandler(async (request) => {
  const viewerId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const directionParam = searchParams.get("direction");

  const status =
    statusParam &&
    Object.values(ExchangeStatus).includes(statusParam as ExchangeStatus)
      ? (statusParam as ExchangeStatus)
      : undefined;

  const direction =
    directionParam === "sent" || directionParam === "received"
      ? directionParam
      : "received";

  const items = await listMyExchangeRequests(viewerId, { status, direction });

  return createSuccessResponse({ items });
});
