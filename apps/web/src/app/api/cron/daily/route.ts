import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { runPostStartReferralScans } from "@/lib/ai/referral-scanner";

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

  const referralResults = await runPostStartReferralScans();
  const triggered = referralResults.filter((r) => r.result !== null);

  return createSuccessResponse({
    referralScans: {
      checked: referralResults.length,
      triggered: triggered.length,
      results: triggered.map((r) => ({
        eventId: r.eventId,
        opportunitiesFound: r.result!.opportunitiesFound,
        feedsCreated: r.result!.feedsCreated,
      })),
    },
  });
});

export const POST = GET;
