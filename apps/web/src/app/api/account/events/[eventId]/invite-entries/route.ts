import { z } from "zod";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";
import {
  createOrReuseInviteEntry,
  InviteEntryError,
} from "@/lib/invite/entry-service";

const createSchema = z.object({
  /** 有值=个人受邀；省略/空=活动通用入口 */
  phone: z.string().optional().nullable(),
  honorific: z.string().max(40).optional().nullable(),
  name: z.string().max(80).optional().nullable(),
  participantId: z.string().optional().nullable(),
  force: z.boolean().optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

/**
 * POST /api/account/events/:eventId/invite-entries
 * 移动管理端创建/复用入口（与 PC 契约一致）
 */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const admin = await requireMobileEventAccess(request, eventId);
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
      createdBy: admin.userId,
    });
    return createSuccessResponse(entry);
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
