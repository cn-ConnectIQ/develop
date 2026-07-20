import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createAnnouncement,
  createAnnouncementSchema,
} from "@/lib/announcement-admin-service";
import { listEventAnnouncements } from "@/lib/interactions/aggregate";
import { assertEventReadableForStaffOrAttendee } from "@/lib/public-event-access";

/** 活动公告列表（参会端 / 管理端共用读） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertEventReadableForStaffOrAttendee(eventId);

  const url = new URL(request.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;
  if (limitRaw && (!Number.isFinite(limit) || limit! <= 0)) {
    return createErrorResponse("limit 须为正整数", ErrorCode.VALIDATION_ERROR, 400);
  }

  const announcements = await listEventAnnouncements(eventId, limit);
  return createSuccessResponse(
    {
      announcements,
      items: announcements,
    },
    { total: announcements.length },
  );
});

/** 主办方发布公告（写入 Announcement 表，参会端可读） */
export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const body = await request.json().catch(() => null);
  const parsed = createAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const created = await createAnnouncement({
    eventId,
    createdBy: session.user.id,
    title: parsed.data.title,
    content: parsed.data.content,
    isPinned: parsed.data.isPinned,
  });

  return createSuccessResponse(created);
});
