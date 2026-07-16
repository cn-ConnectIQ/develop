import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";
import {
  FIXED_PARTICIPANT_INVITE_SUBJECT,
  FIXED_PARTICIPANT_INVITE_TEMPLATE,
} from "@/lib/invite/message";
import {
  getInviteAutoConfig,
  setInviteAutoConfig,
} from "@/lib/invite/invite-auto-config";

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  autoOnBoothStaff: z.boolean().optional(),
  channel: z.enum(["SMS", "EMAIL", "AUTO"]).optional(),
});

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "inviteSystem");
  if (disabled) return disabled;

  const config = await getInviteAutoConfig(eventId);
  return createSuccessResponse({
    ...config,
    fixed_template: FIXED_PARTICIPANT_INVITE_TEMPLATE,
    fixed_subject: FIXED_PARTICIPANT_INVITE_SUBJECT,
  });
});

export const PATCH = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const disabled = await guardEventFeature(eventId, "inviteSystem");
  if (disabled) return disabled;

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const config = await setInviteAutoConfig(eventId, parsed.data);
  return createSuccessResponse({
    ...config,
    fixed_template: FIXED_PARTICIPANT_INVITE_TEMPLATE,
    fixed_subject: FIXED_PARTICIPANT_INVITE_SUBJECT,
  });
});
