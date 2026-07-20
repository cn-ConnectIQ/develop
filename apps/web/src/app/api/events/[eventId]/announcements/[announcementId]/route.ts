import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  deleteAnnouncement,
  updateAnnouncement,
  updateAnnouncementSchema,
} from "@/lib/announcement-admin-service";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const announcementId = context?.params?.announcementId;
  if (!eventId || !announcementId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const row = await prisma.announcement.findFirst({
    where: { id: announcementId, eventId },
  });
  if (!row) {
    return createErrorResponse("公告不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({
    id: row.id,
    title: row.title,
    content: row.content,
    isPinned: row.isPinned,
    is_pinned: row.isPinned,
    publishedAt: row.publishedAt.toISOString(),
    published_at: row.publishedAt.toISOString(),
  });
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const announcementId = context?.params?.announcementId;
  if (!eventId || !announcementId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const body = await request.json().catch(() => null);
  const parsed = updateAnnouncementSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const updated = await updateAnnouncement(
    eventId,
    announcementId,
    parsed.data,
  );
  if (!updated) {
    return createErrorResponse("公告不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(updated);
});

export const DELETE = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const announcementId = context?.params?.announcementId;
  if (!eventId || !announcementId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const ok = await deleteAnnouncement(eventId, announcementId);
  if (!ok) {
    return createErrorResponse("公告不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({ deleted: true });
});
