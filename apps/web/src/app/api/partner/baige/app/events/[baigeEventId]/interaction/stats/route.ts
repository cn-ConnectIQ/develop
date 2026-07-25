import type { NextResponse } from "next/server";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { getBaigeAppEventInteractionStats } from "@/lib/integrations/baige-app-service";
import {
  createBaigePartnerErrorResponse,
  handleBaigePartnerAuth,
  mapBaigeAppError,
} from "@/lib/integrations/baige-partner-http";

/** GET /api/partner/baige/app/events/{baigeEventId}/interaction/stats?baigeOrgId= */
export const GET = withErrorHandler(
  async (request, context): Promise<NextResponse> => {
    const auth = handleBaigePartnerAuth(request);
    if (auth instanceof Response) return auth as NextResponse;

    const baigeEventId = context?.params?.baigeEventId?.trim();
    const baigeOrgId =
      new URL(request.url).searchParams.get("baigeOrgId")?.trim() || "";

    if (!baigeEventId || !baigeOrgId) {
      return createBaigePartnerErrorResponse(
        "缺少 baigeOrgId 或 baigeEventId",
        "VALIDATION",
        400,
      );
    }

    try {
      const data = await getBaigeAppEventInteractionStats({
        baigeOrgId,
        baigeEventId,
      });
      return createSuccessResponse(data);
    } catch (error) {
      const mapped = mapBaigeAppError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
