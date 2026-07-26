import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { runPartnerParticipantReconciliation } from "@/lib/partner-sync/reconciliation";

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

  const summary = await runPartnerParticipantReconciliation();
  return createSuccessResponse(summary);
});

export const POST = GET;
