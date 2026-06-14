import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import type { ZodType } from "zod";
import { getServerSession } from "next-auth";
import { authOptions, hasAnyRole } from "@/lib/auth";
import { ErrorCode, type UserRole } from "@connectiq/types";
import { errorResponse, successResponse } from "@connectiq/utils";

type AppSession = Session & {
  user: Session["user"] & {
    id: string;
    role: UserRole;
    entityId: string | null;
  };
};

type HandlerContext = {
  session: AppSession;
  params: Record<string, string>;
};

type RouteHandler<TBody = unknown> = (
  request: Request,
  context: HandlerContext & { body: TBody },
) => Promise<Response>;

export function jsonSuccess<T>(
  data: T,
  status = 200,
  meta?: { total?: number; page?: number },
) {
  return NextResponse.json(successResponse(data, meta), { status });
}

export function jsonError(error: string, code: ErrorCode, status: number) {
  return NextResponse.json(errorResponse(error, code), { status });
}

export function withAuth<TBody = unknown>(
  handler: RouteHandler<TBody>,
  options?: { roles?: UserRole[]; schema?: ZodType<TBody> },
) {
  return async (
    request: Request,
    routeContext?: { params?: Promise<Record<string, string>> },
  ) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id || !session.user.role) {
        return jsonError("未登录", ErrorCode.UNAUTHORIZED, 401);
      }

      const appSession = session as AppSession;

      if (
        options?.roles &&
        !hasAnyRole(appSession.user.role, options.roles)
      ) {
        return jsonError("无权访问", ErrorCode.FORBIDDEN, 403);
      }

      let body = undefined as TBody;
      if (options?.schema && request.method !== "GET") {
        const raw = await request.json().catch(() => null);
        const parsed = options.schema.safeParse(raw);
        if (!parsed.success) {
          return jsonError(
            parsed.error.issues[0]?.message ?? "参数校验失败",
            ErrorCode.VALIDATION_ERROR,
            400,
          );
        }
        body = parsed.data;
      }

      const params = routeContext?.params ? await routeContext.params : {};

      return await handler(request, {
        session: appSession,
        params,
        body: body as TBody,
      });
    } catch (error) {
      console.error(error);
      return jsonError("服务器内部错误", ErrorCode.INTERNAL_ERROR, 500);
    }
  };
}
