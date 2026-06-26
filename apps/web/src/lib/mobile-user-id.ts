import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError, requireAuth } from "@/lib/api-auth";

/** 解析小程序 Bearer：dev-mock-token / mini_{userId}_* */
export async function resolveMiniBearerUserId(token: string): Promise<string | null> {
  if (token === "dev-mock-token") {
    const demo = await prisma.user.findFirst({
      where: { phone: "13800138000" },
      select: { id: true },
    });
    if (demo) return demo.id;
    const anyUser = await prisma.user.findFirst({ select: { id: true } });
    return anyUser?.id ?? null;
  }

  const prefix = "mini_";
  if (token.startsWith(prefix)) {
    const rest = token.slice(prefix.length);
    const userId = rest.split("_")[0];
    if (userId) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      return user?.id ?? null;
    }
  }

  return null;
}

/** 小程序 / 移动端 Bearer 鉴权（含 dev-mock-token、mini_ token） */
export async function resolveMobileUserId(request: Request): Promise<string> {
  try {
    const { user } = await requireAuth(request);
    return user.id;
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
  }

  const auth = request.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) {
    throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  const userId = await resolveMiniBearerUserId(token);
  if (userId) return userId;

  throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
}
