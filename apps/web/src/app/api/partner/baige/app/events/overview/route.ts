import type { NextResponse } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { getBaigeAppEventsOverview } from "@/lib/integrations/baige-app-service";
import {
  createBaigePartnerErrorResponse,
  handleBaigePartnerAuth,
  mapBaigeAppError,
} from "@/lib/integrations/baige-partner-http";

/**
 * GET /api/partner/baige/app/events/overview?baigeOrgId=
 * 可选：knownBaigeEventIds=1001,1002（逗号分隔，用于计算 unconfiguredCount）
 */
export const GET = withErrorHandler(async (request): Promise<NextResponse> => {
  const auth = handleBaigePartnerAuth(request);
  if (auth instanceof Response) return auth as NextResponse;

  const url = new URL(request.url);
  const baigeOrgId = url.searchParams.get("baigeOrgId")?.trim() || "";
  if (!baigeOrgId) {
    return createBaigePartnerErrorResponse("缺少 baigeOrgId", "VALIDATION", 400);
  }

  const knownRaw = url.searchParams.get("knownBaigeEventIds")?.trim();
  const knownBaigeEventIds = knownRaw
    ? knownRaw.split(/[,|]/).map((s) => s.trim()).filter(Boolean)
    : undefined;

  try {
    const data = await getBaigeAppEventsOverview({
      baigeOrgId,
      knownBaigeEventIds,
    });
    return createSuccessResponse(data);
  } catch (error) {
    const mapped = mapBaigeAppError(error);
    if (mapped) return mapped;
    throw error;
  }
});
