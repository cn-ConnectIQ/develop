import type { NextResponse } from "next/server";
import { z } from "zod";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { patchBaigeAppModule } from "@/lib/integrations/baige-app-service";
import {
  createBaigePartnerErrorResponse,
  handleBaigePartnerAuth,
  mapBaigeAppError,
} from "@/lib/integrations/baige-partner-http";

const bodySchema = z.object({
  enabled: z.boolean(),
  baigeOrgId: z.string().min(1),
});

/**
 * PATCH /api/partner/baige/app/events/{baigeEventId}/modules/{moduleId}
 * Body: { enabled, baigeOrgId }
 *
 * 关闭进行中的抽奖/投票/问答会返回 MODULE_BUSY（409）。
 */
export const PATCH = withErrorHandler(
  async (request, context): Promise<NextResponse> => {
    const auth = handleBaigePartnerAuth(request);
    if (auth instanceof Response) return auth as NextResponse;

    const baigeEventId = context?.params?.baigeEventId?.trim();
    const moduleId = context?.params?.moduleId?.trim();
    if (!baigeEventId || !moduleId) {
      return createBaigePartnerErrorResponse(
        "缺少 baigeEventId 或 moduleId",
        "VALIDATION",
        400,
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return createBaigePartnerErrorResponse(
        parsed.error.issues[0]?.message ?? "参数错误",
        "VALIDATION",
        400,
      );
    }

    try {
      const data = await patchBaigeAppModule({
        baigeOrgId: parsed.data.baigeOrgId,
        baigeEventId,
        moduleId,
        enabled: parsed.data.enabled,
      });
      return createSuccessResponse({
        moduleId,
        enabled: parsed.data.enabled,
        interaction: data,
      });
    } catch (error) {
      const mapped = mapBaigeAppError(error);
      if (mapped) return mapped;
      throw error;
    }
  },
);
