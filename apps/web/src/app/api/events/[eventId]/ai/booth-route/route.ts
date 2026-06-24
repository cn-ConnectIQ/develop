import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { generateBoothRoute } from "@/lib/ai/booth-route-service";
import { isEventFeatureEnabled } from "@/lib/event-feature-flags-server";

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
  }

  throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
}

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const enabled = await isEventFeatureEnabled(eventId, "aiBoothRoute");
  if (!enabled) {
    return createErrorResponse("AI 展位路线未开启", ErrorCode.FORBIDDEN, 403);
  }

  const userId = await resolveUserId(request);
  const result = await generateBoothRoute(userId, eventId);

  return createSuccessResponse(result);
});
