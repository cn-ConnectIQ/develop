import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { B2B_SOCIAL_DEPRECATION_MESSAGE } from "@/lib/deprecated/b2b-social";

/** @deprecated MVP 不做 B2B 社交关注，接口保留以免旧客户端 404 */
export const POST = withErrorHandler(async () =>
  createErrorResponse(B2B_SOCIAL_DEPRECATION_MESSAGE, ErrorCode.FORBIDDEN, 410),
);

export const DELETE = withErrorHandler(async () =>
  createErrorResponse(B2B_SOCIAL_DEPRECATION_MESSAGE, ErrorCode.FORBIDDEN, 410),
);
