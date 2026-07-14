import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { runNotificationTriggers } from "@/lib/notification/cron-triggers";

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization");
  const token = request.nextUrl.searchParams.get("token");
  return auth === `Bearer ${secret}` || token === secret;
}

export const POST = withErrorHandler(async (request: NextRequest) => {
  if (!authorize(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const results = await runNotificationTriggers();
  return createSuccessResponse({ ok: true, results });
});

export const GET = POST;
