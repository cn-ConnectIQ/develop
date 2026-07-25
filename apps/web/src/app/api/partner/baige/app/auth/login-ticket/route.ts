import type { NextResponse } from "next/server";
import { z } from "zod";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { createBaigeLoginTicketForIdentity } from "@/lib/integrations/baige-login-ticket";
import {
  createBaigePartnerErrorResponse,
  handleBaigePartnerAuth,
  mapBaigeAppError,
} from "@/lib/integrations/baige-partner-http";

const bodySchema = z
  .object({
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
 * POST /api/partner/baige/app/auth/login-ticket
 * 百格服务端用已绑定组织 + 用户身份换一次性登录票据。
 * 浏览器：signIn("baige-sso", { loginToken })
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
    const ticket = await createBaigeLoginTicketForIdentity({
      baigeOrgId: parsed.data.baigeOrgId,
      identity: {
        baigeUserId: parsed.data.baigeUserId,
        email: parsed.data.email,
        phone: parsed.data.phone,
        name: parsed.data.name,
      },
    });
    return createSuccessResponse({
      loginToken: ticket.loginToken,
      expiresIn: ticket.expiresIn,
      jiuliOrgId: ticket.jiuliOrgId,
      signInHint: {
        provider: "baige-sso",
        loginToken: ticket.loginToken,
      },
    });
  } catch (error) {
    const mapped = mapBaigeAppError(error);
    if (mapped) return mapped;
    throw error;
  }
});
