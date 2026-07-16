import { z } from "zod";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createOrReuseInviteEntry,
  InviteEntryError,
  listInviteEntriesForEvent,
} from "@/lib/invite/entry-service";
import { generateInviteEntryUrlLink } from "@/lib/wechat/urllink";
import { generateInviteEntryWxacode } from "@/lib/wechat/wxacode";

const createSchema = z.object({
  /** 有值=个人受邀；省略/空=活动通用入口 */
  phone: z.string().optional().nullable(),
  honorific: z.string().max(40).optional().nullable(),
  name: z.string().max(80).optional().nullable(),
  participantId: z.string().optional().nullable(),
  force: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
  includeUrlLink: z.boolean().optional(),
  includeWxacode: z.boolean().optional(),
});

/**
 * POST /api/events/:eventId/invite-entries
 * 管理端：创建/复用受邀入口 token（短信 / 邮件 / 小程序码共用）
 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const entry = await createOrReuseInviteEntry({
      eventId,
      phone: parsed.data.phone,
      honorific: parsed.data.honorific,
      name: parsed.data.name,
      participantId: parsed.data.participantId,
      force: parsed.data.force,
      expiresAt: parsed.data.expiresAt
        ? new Date(parsed.data.expiresAt)
        : null,
      createdBy: session.user.id,
    });

    const extra: {
      urlLink?: string;
      wxacodeDataUrl?: string;
    } = {};

    if (parsed.data.includeUrlLink) {
      try {
        const link = await generateInviteEntryUrlLink({ token: entry.token });
        extra.urlLink = link.urlLink;
      } catch (err) {
        console.warn("[invite-entries] url link skipped:", err);
      }
    }

    if (parsed.data.includeWxacode) {
      try {
        const code = await generateInviteEntryWxacode({
          token: entry.token,
          asDataUrl: true,
        });
        extra.wxacodeDataUrl = code.dataUrl;
      } catch (err) {
        console.warn("[invite-entries] wxacode skipped:", err);
      }
    }

    return createSuccessResponse({ ...entry, ...extra });
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
    if (err instanceof Error && /手机号/.test(err.message)) {
      return createErrorResponse(err.message, ErrorCode.VALIDATION_ERROR, 400);
    }
    throw err;
  }
});

/** GET /api/events/:eventId/invite-entries?phone= */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const phone = new URL(request.url).searchParams.get("phone") ?? undefined;

  try {
    const entries = await listInviteEntriesForEvent(eventId, { phone });
    return createSuccessResponse({ entries });
  } catch (err) {
    if (err instanceof Error && /手机号/.test(err.message)) {
      return createErrorResponse(err.message, ErrorCode.VALIDATION_ERROR, 400);
    }
    throw err;
  }
});
