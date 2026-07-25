import type { NextResponse } from "next/server";
import { z } from "zod";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { confirmQrLoginSession } from "@/lib/integrations/baige-login-ticket";
import {
  createBaigePartnerErrorResponse,
  handleBaigePartnerAuth,
  mapBaigeAppError,
} from "@/lib/integrations/baige-partner-http";

const bodySchema = z
  .object({
    sessionId: z.string().min(8),
    baigeOrgId: z.string().min(1),
    baigeUserId: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().regex(/^1[3-9]\d{9}$/).optional(),
    name: z.string().max(80).optional(),
  })
  .refine(
    (v) => Boolean(v.baigeUserId || v.email || v.phone),
    { message: "请提供 email、phone 或 baigeUserId" },
  );

/**
 * POST /api/partner/baige/app/auth/qr-login/confirm
 * 百格 App 扫码确认 PC 端登录。
 */
export const POST = withErrorHandler(async (request): Promise<NextResponse> => {
  const auth = handleBaigePartnerAuth(request);
  if (auth instanceof Response) return auth as NextResponse;

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
    const result = await confirmQrLoginSession({
      sessionId: parsed.data.sessionId,
      baigeOrgId: parsed.data.baigeOrgId,
      identity: {
        baigeUserId: parsed.data.baigeUserId,
        email: parsed.data.email,
        phone: parsed.data.phone,
        name: parsed.data.name,
      },
    });
    return createSuccessResponse({
      ok: true,
      alreadyConfirmed: result.alreadyConfirmed,
      jiuliOrgId: "jiuliOrgId" in result ? result.jiuliOrgId : undefined,
    });
  } catch (error) {
    const mapped = mapBaigeAppError(error);
    if (mapped) return mapped;
    throw error;
  }
});
