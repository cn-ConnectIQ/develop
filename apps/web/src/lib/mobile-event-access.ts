import { requireEventAccess } from "@/lib/api-auth";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";

/** Web session 或小程序 Bearer 活动管理鉴权 */
export async function requireEventAccessMobileOrWeb(
  request: Request,
  eventId: string,
): Promise<void> {
  try {
    await requireMobileEventAccess(request, eventId);
    return;
  } catch {
    await requireEventAccess(eventId);
  }
}
