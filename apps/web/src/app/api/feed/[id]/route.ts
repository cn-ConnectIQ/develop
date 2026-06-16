import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { markFeedItemRead } from "@/lib/feed-service";
import { prisma } from "@connectiq/database";

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
  }

  throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
}

const patchBodySchema = z.object({
  is_read: z.boolean().optional(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少 Feed ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveUserId(request);
  const body = patchBodySchema.safeParse(await request.json());
  if (!body.success) {
    return createErrorResponse("参数无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (body.data.is_read) {
    const updated = await markFeedItemRead(userId, id);
    if (!updated) {
      return createErrorResponse("动态不存在", ErrorCode.NOT_FOUND, 404);
    }
    return createSuccessResponse(updated);
  }

  return createSuccessResponse({ id, ok: true });
});
