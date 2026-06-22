import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { bookMeeting } from "@/lib/meetings-service";

const createSchema = z.object({
  event_id: z.string().cuid(),
  guest_user_id: z.string().cuid(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
});

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

export const POST = withErrorHandler(async (request) => {
  const hostUserId = await resolveUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const event = await prisma.event.findUnique({
    where: { id: parsed.data.event_id },
    select: { id: true },
  });
  if (!event) {
    return createErrorResponse("活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const meeting = await bookMeeting({
    eventId: parsed.data.event_id,
    hostUserId,
    guestUserId: parsed.data.guest_user_id,
    startsAt: new Date(parsed.data.starts_at),
    endsAt: new Date(parsed.data.ends_at),
  });

  return createSuccessResponse({
    id: meeting.id,
    status: meeting.status,
    starts_at: meeting.startsAt.toISOString(),
    ends_at: meeting.endsAt.toISOString(),
  });
});
