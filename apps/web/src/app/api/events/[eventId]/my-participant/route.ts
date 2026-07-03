import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

/** 当前登录用户在本活动的参会者档案（onboarding 预填） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const participant = await findParticipantForUser(eventId, userId);

  if (!participant) {
    return createSuccessResponse(null);
  }

  return createSuccessResponse({
    id: participant.id,
    name: participant.name,
    email: participant.email,
    phone: participant.phone,
    company: participant.company,
    jobTitle: participant.jobTitle,
    job_title: participant.jobTitle,
    title: participant.jobTitle,
    badge_qr: participant.badgeQr,
  });
});
