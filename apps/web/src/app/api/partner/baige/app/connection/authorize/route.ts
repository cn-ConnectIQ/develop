import type { NextResponse } from "next/server";
import { z } from "zod";
import { createSuccessResponse, withErrorHandler } from "@/lib/api-auth";
import { startBaigeAppAuthorize } from "@/lib/integrations/baige-app-service";
import { normalizePhone } from "@/lib/integrations/baige-identity-link";
import { BAIGE_APP_SCOPES } from "@/lib/integrations/baige-partner-constants";
import {
  createBaigePartnerErrorResponse,
  handleBaigePartnerAuth,
  mapBaigeAppError,
} from "@/lib/integrations/baige-partner-http";

/** 无效邮箱不拖垮整单：丢掉后若仍有 phone+baigeUserId 可自动开户，否则走 authorizeUrl */
function softEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return undefined;
  return z.string().email().safeParse(t).success ? t : undefined;
}

const authorizeSchema = z.object({
  baigeOrgId: z.string().min(1),
  baigeUserId: z.string().optional(),
  email: z.preprocess(softEmail, z.string().email().optional()),
  phone: z.preprocess(
    (v) => (typeof v === "string" ? normalizePhone(v) ?? undefined : undefined),
    z.string().regex(/^1[3-9]\d{9}$/).optional(),
  ),
  name: z.string().max(80).optional(),
  orgName: z.string().max(64).optional(),
  scopes: z.array(z.string()).optional(),
  redirectUri: z.string().optional(),
  /** 联调/已明确映射时一键绑定（跳过确认页） */
  jiuliOrgId: z.string().optional(),
});

/** POST /api/partner/baige/app/connection/authorize */
export const POST = withErrorHandler(async (request): Promise<NextResponse> => {
  const auth = handleBaigePartnerAuth(request);
  if (auth instanceof Response) return auth as NextResponse;

  const body = await request.json().catch(() => null);
  const parsed = authorizeSchema.safeParse(body);
  if (!parsed.success) {
    return createBaigePartnerErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      "VALIDATION",
      400,
    );
  }

  try {
    const result = await startBaigeAppAuthorize({
      ...parsed.data,
      scopes: parsed.data.scopes?.length
        ? parsed.data.scopes
        : [...BAIGE_APP_SCOPES],
    });

    if (result.mode === "linked") {
      return createSuccessResponse({
        ...result.connection,
        linkedUserId: result.linkedUserId ?? null,
        orgCreated: result.orgCreated ?? false,
      });
    }
    return createSuccessResponse({
      authorizeUrl: result.authorizeUrl,
      state: result.state,
    });
  } catch (error) {
    const mapped = mapBaigeAppError(error);
    if (mapped) return mapped;
    throw error;
  }
});
