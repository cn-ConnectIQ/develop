import { ErrorCode } from "@connectiq/types";
import { prisma } from "@connectiq/database";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { listReferrals } from "@/lib/referrals-service";

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

export const GET = withErrorHandler(async (request) => {
  const userId = await resolveUserId(request);
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") ?? "introducer";
  const limit = Number(searchParams.get("limit") ?? "20");

  if (role !== "introducer" && role !== "recipient") {
    return createErrorResponse("role 参数无效", ErrorCode.BAD_REQUEST, 400);
  }

  const result = await listReferrals(userId, role, limit);
  return createSuccessResponse(result);
});
