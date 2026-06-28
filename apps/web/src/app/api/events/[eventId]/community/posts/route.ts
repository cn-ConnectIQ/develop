import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createCommunityPost,
  listCommunityPosts,
} from "@/lib/community-posts-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const postBodySchema = z.object({
  content: z.string().min(1).max(2000),
});

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const posts = await listCommunityPosts(eventId);
  return createSuccessResponse(posts, { total: posts.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const post = await createCommunityPost(eventId, userId, parsed.data.content);
  return createSuccessResponse(post);
});
