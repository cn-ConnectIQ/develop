import { NextRequest } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { processDueInviteCampaigns } from "@/lib/invite-sender";

function verifyCronAuth(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

/** 推进邀请批量发送：回收卡住的 SENDING，续跑 SENDING/到期 SCHEDULED 活动 */
export const GET = withErrorHandler(async (request) => {
  if (!verifyCronAuth(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await processDueInviteCampaigns();
  return createSuccessResponse(result);
});

export const POST = GET;
