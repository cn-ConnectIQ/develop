import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";

/** 会后 AI 跟进（AI-07）已停用：会后触达由微信小程序负责，ConnectIQ 不再跑留存序列。 */
const DISABLED = {
  enabled: false,
  reason: "post_event_followup_disabled",
  message: "会后跟进已移交微信，此 cron 不再执行",
} as const;

function verifyCronAuth(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handleCron(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  return createSuccessResponse(DISABLED);
}

export const GET = withErrorHandler(handleCron);

export const POST = withErrorHandler(handleCron);
