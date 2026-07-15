import { createErrorResponse, createSuccessResponse, getSession, withErrorHandler } from "@/lib/api-auth";
import { resolveInviteToken } from "@/lib/invite/claim-service";
import { ErrorCode } from "@connectiq/types";

/** GET /api/invite/resolve?token= */
export const GET = withErrorHandler(async (request) => {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const session = await getSession().catch(() => null);
  const data = await resolveInviteToken({
    token,
    sessionUserId: session?.user?.id ?? null,
  });
  if (data.kind === "invalid") {
    return createErrorResponse("邀请链接无效", ErrorCode.NOT_FOUND, 404);
  }
  if (data.kind === "expired") {
    return createErrorResponse("邀请链接已过期", ErrorCode.VALIDATION_ERROR, 410);
  }
  return createSuccessResponse(data);
});

export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const token = String(body?.token ?? "");
  const wxCode = body?.wxCode ? String(body.wxCode) : undefined;
  const session = await getSession().catch(() => null);
  const data = await resolveInviteToken({
    token,
    wxCode,
    sessionUserId: session?.user?.id ?? null,
  });
  if (data.kind === "invalid") {
    return createErrorResponse("邀请链接无效", ErrorCode.NOT_FOUND, 404);
  }
  if (data.kind === "expired") {
    return createErrorResponse("邀请链接已过期", ErrorCode.VALIDATION_ERROR, 410);
  }
  return createSuccessResponse(data);
});
