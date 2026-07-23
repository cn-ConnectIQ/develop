import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  assertBaigePartnerApiKey,
  BaigePartnerAuthError,
} from "@/lib/integrations/baige-partner-auth";
import {
  authorizeBaigeEvents,
  resolveOrgIdForBaigeAuthorize,
} from "@/lib/integrations/baige-event-authorize";
import { BaigeConnectionError } from "@/lib/integrations/baige-connection-service";
import { prisma } from "@connectiq/database";

const eventSchema = z.object({
  baigeEventId: z.string().min(1),
  name: z.string().min(1),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  syncParticipants: z.boolean().optional(),
});

const bodySchema = z.object({
  orgId: z.string().optional(),
  baigeOrgId: z.string().optional(),
  events: z.array(eventSchema).min(1),
  actorUserId: z.string().optional(),
});

export const POST = withErrorHandler(async (request) => {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  let orgId = parsed.data.orgId ?? null;
  let actorUserId = parsed.data.actorUserId ?? null;

  // 优先：已登录账号管理员（玖莅管理端）
  const sessionResult = await requireAccountAdmin();
  if (!("error" in sessionResult)) {
    orgId = sessionResult.orgId;
    actorUserId = sessionResult.session.user.id;
  } else {
    // 百格服务端：伙伴 API Key
    try {
      assertBaigePartnerApiKey(request);
    } catch (error) {
      if (error instanceof BaigePartnerAuthError) {
        return createErrorResponse(error.message, ErrorCode.UNAUTHORIZED, error.status);
      }
      throw error;
    }
  }

  try {
    orgId = await resolveOrgIdForBaigeAuthorize({
      orgId,
      externalOrgId: parsed.data.baigeOrgId,
    });

    if (!actorUserId) {
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { ownerId: true },
      });
      actorUserId = org?.ownerId ?? null;
    }
    if (!actorUserId) {
      return createErrorResponse(
        "无法确定操作人，请传 actorUserId 或确保组织有 owner",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }

    const result = await authorizeBaigeEvents({
      orgId,
      actorUserId,
      events: parsed.data.events,
    });
    return createSuccessResponse(result);
  } catch (error) {
    if (error instanceof BaigeConnectionError) {
      return createErrorResponse(error.message, ErrorCode.VALIDATION_ERROR, 400);
    }
    throw error;
  }
});
