import { IntentCategory, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

function slugify(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, "")
    .slice(0, 48) || `tag-${Date.now().toString(36)}`;
}

export async function listPlatformIntentTags() {
  return prisma.intentTag.findMany({
    where: { eventId: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function listEventIntentTags(eventId: string) {
  return prisma.intentTag.findMany({
    where: { eventId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createIntentTag(input: {
  eventId?: string | null;
  label: string;
  slug?: string;
  category?: IntentCategory | null;
  color?: string | null;
  sortOrder?: number;
}) {
  const slug = input.slug?.trim() || slugify(input.label);
  const existing = await prisma.intentTag.findFirst({
    where: { eventId: input.eventId ?? null, slug },
  });
  if (existing) {
    throw new ApiError("标签 slug 已存在", ErrorCode.VALIDATION_ERROR, 400);
  }
  return prisma.intentTag.create({
    data: {
      eventId: input.eventId ?? null,
      label: input.label.trim(),
      slug,
      category: input.category ?? null,
      color: input.color ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateIntentTag(
  tagId: string,
  input: {
    label?: string;
    category?: IntentCategory | null;
    color?: string | null;
    sortOrder?: number;
  },
  scope: { eventId?: string | null } = {},
) {
  const tag = await prisma.intentTag.findFirst({
    where: {
      id: tagId,
      eventId: scope.eventId === undefined ? undefined : scope.eventId,
    },
  });
  if (!tag) {
    throw new ApiError("标签不存在", ErrorCode.NOT_FOUND, 404);
  }
  return prisma.intentTag.update({
    where: { id: tagId },
    data: {
      ...(input.label !== undefined ? { label: input.label.trim() } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
}

export async function deleteIntentTag(
  tagId: string,
  scope: { eventId?: string | null } = {},
) {
  const tag = await prisma.intentTag.findFirst({
    where: {
      id: tagId,
      eventId: scope.eventId === undefined ? undefined : scope.eventId,
    },
  });
  if (!tag) {
    throw new ApiError("标签不存在", ErrorCode.NOT_FOUND, 404);
  }
  await prisma.intentTag.delete({ where: { id: tagId } });
}

export async function copyPlatformTagsToEvent(eventId: string, tagIds?: string[]) {
  const templates = await prisma.intentTag.findMany({
    where: {
      eventId: null,
      ...(tagIds?.length ? { id: { in: tagIds } } : {}),
    },
  });
  let copied = 0;
  for (const t of templates) {
    const exists = await prisma.intentTag.findFirst({
      where: { eventId, slug: t.slug },
    });
    if (exists) continue;
    await prisma.intentTag.create({
      data: {
        eventId,
        label: t.label,
        slug: t.slug,
        category: t.category,
        color: t.color,
        sortOrder: t.sortOrder,
      },
    });
    copied += 1;
  }
  return { copied };
}
