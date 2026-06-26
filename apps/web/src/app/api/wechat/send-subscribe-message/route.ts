import { ErrorCode } from "@connectiq/types";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getUserWechatOpenId,
  sendSubscribeMessage,
  type SubscribeMessageScene,
} from "@/lib/wechat/subscribe-message";

const sceneSchema = z.enum([
  "EXCHANGE_REQUEST",
  "EXCHANGE_RESULT",
  "MEETING_INVITE",
  "EXHIBITOR_INVITE",
  "LOTTERY_RESULT",
]);

const bodySchema = z.object({
  scene: sceneSchema,
  touser: z.string().min(1).optional(),
  user_id: z.string().min(1).optional(),
  page: z.string().optional(),
  data: z.record(z.object({ value: z.string() })).optional(),
});

function verifyInternalAuth(request: NextRequest): boolean {
  const secret =
    process.env.WECHAT_INTERNAL_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV === "development";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** 内部调用：发送微信小程序订阅消息 */
export const POST = withErrorHandler(async (request) => {
  if (!verifyInternalAuth(request)) {
    return createErrorResponse("无权访问", ErrorCode.FORBIDDEN, 403);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  let touser = parsed.data.touser;
  if (!touser && parsed.data.user_id) {
    touser = (await getUserWechatOpenId(parsed.data.user_id)) ?? undefined;
  }
  if (!touser) {
    return createErrorResponse("缺少 touser 或 user_id", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await sendSubscribeMessage({
    touser,
    scene: parsed.data.scene as SubscribeMessageScene,
    page: parsed.data.page,
    data: parsed.data.data,
  });

  return createSuccessResponse(result);
});
