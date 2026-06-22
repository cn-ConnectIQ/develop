import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { runMatchingUpdateForLiveEvents } from "@/lib/ai/matching-service";

function verifyCronAuth(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export const GET = withErrorHandler(async (request) => {
  if (!verifyCronAuth(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const results = await runMatchingUpdateForLiveEvents();

  return createSuccessResponse({
    eventsProcessed: results.length,
    results,
  });
});
