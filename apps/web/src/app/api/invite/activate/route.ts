import { ErrorCode } from "@connectiq/types";
import { NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { buildActivationLink } from "@/lib/invite/message";
import { recordInviteClick, resolveJoinPageData } from "@/lib/invite/service";

const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ??
  "https://app.connectiq.cn/download";

/** 记录邀请链接点击（幂等，仅首次计入统计） */
export const POST = withErrorHandler(async (request) => {
  const body = (await request.json()) as { token?: string; event?: string };
  const token = body.token?.trim();

  if (!token) {
    return createErrorResponse("缺少 token", ErrorCode.VALIDATION_ERROR, 400);
  }

  await recordInviteClick(token);
  const data = await resolveJoinPageData(token, body.event, {
    recordClick: false,
  });

  if (data.kind === "invalid") {
    return createErrorResponse("邀请链接无效或已过期", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({
    token,
    kind: data.kind,
    activationLink: buildActivationLink(token, data.event.id),
    downloadUrl: data.downloadUrl,
    deepLink: data.deepLink,
    event: data.event,
    organizerName: data.organizerName,
    participantName: data.participantName,
    ...(data.kind === "valid"
      ? { tokenExpiresAt: data.tokenExpiresAt }
      : {}),
  });
});

/** 查询激活信息；redirect=1 时跳转至 App 下载页 */
export const GET = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const eventId = searchParams.get("event") ?? undefined;
  const shouldRedirect = searchParams.get("redirect") === "1";

  if (!token) {
    return createErrorResponse("缺少 token", ErrorCode.VALIDATION_ERROR, 400);
  }

  await recordInviteClick(token);
  const data = await resolveJoinPageData(token, eventId, {
    recordClick: false,
  });

  if (data.kind === "invalid") {
    return createErrorResponse("邀请链接无效", ErrorCode.NOT_FOUND, 404);
  }

  const payload = {
    token,
    kind: data.kind,
    activationLink: buildActivationLink(token, data.event.id),
    downloadUrl: data.downloadUrl,
    deepLink: data.deepLink,
    event: data.event,
    organizerName: data.organizerName,
    participantName: data.participantName,
    redirectUrl: data.downloadUrl,
    ...(data.kind === "valid"
      ? { tokenExpiresAt: data.tokenExpiresAt }
      : {}),
  };

  if (shouldRedirect) {
    return NextResponse.redirect(payload.redirectUrl);
  }

  return createSuccessResponse(payload);
});
