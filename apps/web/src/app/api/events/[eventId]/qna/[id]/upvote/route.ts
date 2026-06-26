import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { upvoteEventMobileQnaQuestion } from "@/lib/mobile-qna-service";
import { requireMobileAuth } from "@/lib/mobile-user-id";

/** 现场问答点赞 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const id = context?.params?.id;
  if (!eventId || !id) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileAuth(request);
  const data = await upvoteEventMobileQnaQuestion(eventId, userId, id);
  return createSuccessResponse(data);
});
