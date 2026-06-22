import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { runPostEventFollowup } from "@/lib/ai/post-event-followup-service";

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

  const result = await runPostEventFollowup();

  return createSuccessResponse({
    processed: result.eventsProcessed,
    phasesTriggered: result.phasesTriggered,
    feedsCreated: result.feedsCreated,
    notificationsCreated: result.notificationsCreated,
  });
}

export const GET = withErrorHandler(handleCron);

export const POST = withErrorHandler(handleCron);
