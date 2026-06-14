import { ErrorCode } from "@connectiq/types";
import { getServerSession } from "next-auth";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { participateInSession } from "@/lib/interaction/session-service";
import { participateSessionSchema } from "@/lib/interaction/schemas";
import { authOptions } from "@/lib/auth";

/** 公开：扫码参与互动会话 */
export const POST = withErrorHandler(async (request, context) => {
  const sessionCode = context?.params?.sessionCode;
  if (!sessionCode) {
    return createErrorResponse("缺少会话码", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = participateSessionSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const authSession = await getServerSession(authOptions);
  const userId =
    parsed.data.user_id ?? authSession?.user?.id ?? null;

  const result = await participateInSession(
    sessionCode,
    userId,
    parsed.data.poll_response,
  );

  return createSuccessResponse(result);
});
