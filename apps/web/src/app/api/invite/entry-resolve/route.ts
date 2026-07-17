import { z } from "zod";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  InviteEntryError,
  resolveInviteEntry,
} from "@/lib/invite/entry-service";
import {
  assertInviteEntryResolveRateLimit,
  clientIpFromRequest,
} from "@/lib/invite/entry-rate-limit";

const bodySchema = z
  .object({
    token: z.string().optional(),
    scene: z.string().optional(),
  })
  .refine((v) => Boolean(v.token?.trim() || v.scene?.trim()), {
    message: "请提供 token 或 scene",
  });

/**
 * POST /api/invite/entry-resolve
 * 小程序 AC1：匿名兑换 token → eventId + phone?
 *
 * 接受：
 * - InviteEntry.token（小程序码 / URL Link）
 * - InviteRecord.activationToken（短信短链 9li.co/a/... 里那段）
 */
export const POST = withErrorHandler(async (request) => {
  const rate = await assertInviteEntryResolveRateLimit(
    clientIpFromRequest(request),
  );
  if (!rate.ok) {
    return createErrorResponse(
      `请求过于频繁，请 ${rate.retryAfter} 秒后再试`,
      ErrorCode.VALIDATION_ERROR,
      429,
    );
  }

  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数缺失",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const data = await resolveInviteEntry(parsed.data);
    return createSuccessResponse({
      eventId: data.eventId,
      phone: data.phone,
      mode: data.mode,
      eventName: data.eventName,
      honorific: data.honorific,
      name: data.name,
    });
  } catch (err) {
    if (err instanceof InviteEntryError) {
      const code =
        err.code === "NOT_FOUND"
          ? ErrorCode.NOT_FOUND
          : err.code === "GONE"
            ? ErrorCode.GONE
            : ErrorCode.VALIDATION_ERROR;
      return createErrorResponse(err.message, code, err.status);
    }
    throw err;
  }
});
