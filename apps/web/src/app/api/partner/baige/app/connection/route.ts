import type { NextResponse } from "next/server";
import { z } from "zod";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import {
  formatBaigeAppConnection,
  revokeBaigeAppConnection,
} from "@/lib/integrations/baige-app-service";
import {
  createBaigePartnerErrorResponse,
  handleBaigePartnerAuth,
  mapBaigeAppError,
} from "@/lib/integrations/baige-partner-http";

/** GET /api/partner/baige/app/connection?baigeOrgId= */
export const GET = withErrorHandler(async (request): Promise<NextResponse> => {
  const auth = handleBaigePartnerAuth(request);
  if (auth instanceof Response) return auth as NextResponse;

  const baigeOrgId =
    new URL(request.url).searchParams.get("baigeOrgId")?.trim() || "";
  if (!baigeOrgId) {
    return createBaigePartnerErrorResponse("缺少 baigeOrgId", "VALIDATION", 400);
  }

  const connection = await formatBaigeAppConnection(baigeOrgId);
  return createSuccessResponse(connection);
});

const revokeSchema = z.object({
  baigeOrgId: z.string().min(1),
});

/** DELETE /api/partner/baige/app/connection  Body: { baigeOrgId } */
export const DELETE = withErrorHandler(
  async (request): Promise<NextResponse> => {
    const auth = handleBaigePartnerAuth(request);
    if (auth instanceof Response) return auth as NextResponse;

    const body = await request.json().catch(() => null);
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      return createBaigePartnerErrorResponse(
        parsed.error.issues[0]?.message ?? "缺少 baigeOrgId",
        "VALIDATION",
        400,
      );
    }

    try {
      await revokeBaigeAppConnection(parsed.data.baigeOrgId);
      return createSuccessResponse({
        linked: false,
        baigeOrgId: parsed.data.baigeOrgId,
      });
    } catch (error) {
      const mapped = mapBaigeAppError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
