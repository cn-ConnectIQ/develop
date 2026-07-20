import { prisma } from "@connectiq/database";
import { z } from "zod";

export const createAnnouncementSchema = z.object({
  title: z.string().trim().min(1, "请输入标题").max(200),
  content: z.string().trim().min(1, "请输入正文").max(10000),
  isPinned: z.boolean().optional(),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().trim().min(1).max(10000).optional(),
  isPinned: z.boolean().optional(),
});

export type AnnouncementAdminItem = {
  id: string;
  title: string;
  content: string;
  summary: string;
  isPinned: boolean;
  is_pinned: boolean;
  publishedAt: string;
  published_at: string;
};

function truncateSummary(content: string, max = 80) {
  const text = content.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function serialize(row: {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  publishedAt: Date;
}): AnnouncementAdminItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    summary: truncateSummary(row.content),
    isPinned: row.isPinned,
    is_pinned: row.isPinned,
    publishedAt: row.publishedAt.toISOString(),
    published_at: row.publishedAt.toISOString(),
  };
}

export async function listAnnouncementsForEvent(eventId: string, limit = 100) {
  const rows = await prisma.announcement.findMany({
    where: { eventId },
    orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(limit, 1), 200),
  });
  return rows.map(serialize);
}

export async function createAnnouncement(input: {
  eventId: string;
  createdBy: string;
  title: string;
  content: string;
  isPinned?: boolean;
}) {
  const row = await prisma.announcement.create({
    data: {
      eventId: input.eventId,
      createdBy: input.createdBy,
      title: input.title,
      content: input.content,
      isPinned: input.isPinned ?? false,
      publishedAt: new Date(),
    },
  });
  return serialize(row);
}

export async function updateAnnouncement(
  eventId: string,
  announcementId: string,
  data: z.infer<typeof updateAnnouncementSchema>,
) {
  const existing = await prisma.announcement.findFirst({
    where: { id: announcementId, eventId },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.announcement.update({
    where: { id: announcementId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.content !== undefined ? { content: data.content } : {}),
      ...(data.isPinned !== undefined ? { isPinned: data.isPinned } : {}),
    },
  });
  return serialize(row);
}

export async function deleteAnnouncement(
  eventId: string,
  announcementId: string,
) {
  const existing = await prisma.announcement.findFirst({
    where: { id: announcementId, eventId },
    select: { id: true },
  });
  if (!existing) return false;
  await prisma.announcement.delete({ where: { id: announcementId } });
  return true;
}
