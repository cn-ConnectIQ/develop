import { Prisma, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";

const POSTS_KEY = "community_posts";
const ICEBREAKERS_KEY = "community_icebreakers";

export type ApiCommunityPost = {
  id: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  topic?: string;
  like_count: number;
  comment_count: number;
  created_at: string;
};

type StoredPost = {
  id: string;
  author_user_id: string;
  author_name: string;
  author_avatar?: string;
  content: string;
  topic?: string;
  like_count?: number;
  comment_count?: number;
  created_at: string;
};

const DEFAULT_ICEBREAKERS = [
  "你今天是带着什么目标来参会的？",
  "最近行业里你最关注的一个趋势是什么？",
  "如果只能选一位现场嘉宾深聊，你会选谁、聊什么？",
  "你的团队目前在找哪类合作伙伴？",
  "有没有一个你特别想逛的展位或论坛？",
];

function parsePosts(value: unknown): StoredPost[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id : "";
    const content = typeof row.content === "string" ? row.content.trim() : "";
    const authorName = typeof row.author_name === "string" ? row.author_name : "";
    const authorUserId =
      typeof row.author_user_id === "string" ? row.author_user_id : "";
    const createdAt =
      typeof row.created_at === "string" ? row.created_at : new Date().toISOString();
    if (!id || !content || !authorName) return [];
    return [
      {
        id,
        author_user_id: authorUserId,
        author_name: authorName,
        author_avatar:
          typeof row.author_avatar === "string" ? row.author_avatar : undefined,
        content,
        topic: typeof row.topic === "string" ? row.topic : undefined,
        like_count: Number(row.like_count ?? 0),
        comment_count: Number(row.comment_count ?? 0),
        created_at: createdAt,
      },
    ];
  });
}

function mapPost(row: StoredPost): ApiCommunityPost {
  return {
    id: row.id,
    author_name: row.author_name,
    author_avatar: row.author_avatar,
    content: row.content,
    topic: row.topic,
    like_count: row.like_count ?? 0,
    comment_count: row.comment_count ?? 0,
    created_at: row.created_at,
  };
}

async function loadStoredPosts(eventId: string): Promise<StoredPost[]> {
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: POSTS_KEY } },
    select: { value: true },
  });
  return parsePosts(row?.value);
}

async function saveStoredPosts(eventId: string, posts: StoredPost[]) {
  const value = posts as unknown as Prisma.InputJsonValue;
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: POSTS_KEY } },
    create: { eventId, key: POSTS_KEY, value },
    update: { value },
  });
}

export async function listCommunityPosts(
  eventId: string,
): Promise<ApiCommunityPost[]> {
  await assertAttendeeReadableEvent(eventId);
  const posts = await loadStoredPosts(eventId);
  return posts
    .map(mapPost)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
}

export async function createCommunityPost(
  eventId: string,
  userId: string,
  content: string,
): Promise<ApiCommunityPost> {
  await assertAttendeeReadableEvent(eventId);

  const trimmed = content.trim();
  if (!trimmed) {
    throw new ApiError("内容不能为空", ErrorCode.VALIDATION_ERROR, 400);
  }
  if (trimmed.length > 2000) {
    throw new ApiError("内容过长", ErrorCode.VALIDATION_ERROR, 400);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  const posts = await loadStoredPosts(eventId);
  const created: StoredPost = {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    author_user_id: user.id,
    author_name: user.name,
    content: trimmed,
    like_count: 0,
    comment_count: 0,
    created_at: new Date().toISOString(),
  };

  await saveStoredPosts(eventId, [created, ...posts]);
  return mapPost(created);
}

export async function listCommunityIcebreakers(eventId: string): Promise<string[]> {
  await assertAttendeeReadableEvent(eventId);
  const row = await prisma.eventSetting.findUnique({
    where: { eventId_key: { eventId, key: ICEBREAKERS_KEY } },
    select: { value: true },
  });
  if (Array.isArray(row?.value)) {
    const items = row.value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    if (items.length > 0) return items;
  }
  return DEFAULT_ICEBREAKERS;
}

export async function seedCommunityPosts(
  eventId: string,
  posts: StoredPost[],
  icebreakers?: string[],
) {
  if (posts.length > 0) {
    await saveStoredPosts(eventId, posts);
  }
  if (icebreakers?.length) {
    await prisma.eventSetting.upsert({
      where: { eventId_key: { eventId, key: ICEBREAKERS_KEY } },
      create: {
        eventId,
        key: ICEBREAKERS_KEY,
        value: icebreakers,
      },
      update: { value: icebreakers },
    });
  }
}
