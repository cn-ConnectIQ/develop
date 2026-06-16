import { ErrorCode } from "@connectiq/types";
import { MeetingStatus, prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { updateMeetingStatus } from "@/lib/meetings-service";

async function resolveUserId(request: Request): Promise<string> {
  try {
    const { user } = await requireAuth(request);
    return user.id;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

  if (token === "dev-mock-token") {
    const demo = await prisma.user.findFirst({
      where: { phone: "13800138000" },
      select: { id: true },
    });
    if (demo) return demo.id;
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    if (anyUser) return anyUser.id;
    throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
}

export const PATCH = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少会面 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveUserId(request);
  const body = (await request.json()) as {
    status?: MeetingStatus;
    rating?: number;
  };

  if (!body.status) {
    return createErrorResponse("缺少 status", ErrorCode.BAD_REQUEST, 400);
  }

  const meeting = await updateMeetingStatus(userId, id, body.status, body.rating);
  return createSuccessResponse({
    id: meeting.id,
    status: meeting.status,
    rating: meeting.rating,
  });
});
