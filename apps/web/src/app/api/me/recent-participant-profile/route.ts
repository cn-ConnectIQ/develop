import {
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveRecentGuestProfileForUser } from "@/lib/interaction/participant-user";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/**
 * 小程序扫码入池：取最近一次参与活动的嘉宾资料，用于表单自动填入。
 * Query: exclude_event_id（可选，排除当前活动）
 */
export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const excludeEventId =
    new URL(request.url).searchParams.get("exclude_event_id")?.trim() ||
    undefined;

  const profile = await resolveRecentGuestProfileForUser(userId, {
    excludeEventId,
  });

  return createSuccessResponse(
    profile ?? {
      name: "",
      company: "",
      job_title: "",
      phone: "",
      source_event_id: null,
      source_event_name: null,
      complete: false,
    },
  );
});
