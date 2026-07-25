import { ErrorCode } from "@connectiq/types";
import type { NextResponse } from "next/server";
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
import { BAIGE_PROVIDER } from "@/lib/integrations/baige-partner-constants";
import { InviteStatus, OrgStaffRole, prisma } from "@connectiq/database";

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

export const POST = withErrorHandler(async (request): Promise<NextResponse> => {
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

    actorUserId = await resolveValidEventOrganizerUserId({
      orgId,
      preferredUserId: actorUserId,
    });
    if (!actorUserId) {
      return createErrorResponse(
        "无法确定操作人：请传有效的玖莅 actorUserId，或确保组织有 owner",
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

/**
 * 开通活动时 organizer_id 必须是玖莅 users.id。
 * 百格常误传 baigeUserId → 外键失败 INTERNAL_ERROR；无效则回退组织 owner / 绑定人 / 管理员。
 */
async function resolveValidEventOrganizerUserId(input: {
  orgId: string;
  preferredUserId: string | null;
}): Promise<string | null> {
  async function ifExistingUser(id: string | null | undefined) {
    const trimmed = id?.trim();
    if (!trimmed) return null;
    const row = await prisma.user.findUnique({
      where: { id: trimmed },
      select: { id: true },
    });
    return row?.id ?? null;
  }

  const preferred = await ifExistingUser(input.preferredUserId);
  if (preferred) return preferred;

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { ownerId: true },
  });
  const owner = await ifExistingUser(org?.ownerId);
  if (owner) return owner;

  const linked = await prisma.partnerConnection.findFirst({
    where: { orgId: input.orgId, provider: BAIGE_PROVIDER },
    select: { linkedByUserId: true },
  });
  const linker = await ifExistingUser(linked?.linkedByUserId);
  if (linker) return linker;

  const staff = await prisma.orgStaff.findFirst({
    where: {
      orgId: input.orgId,
      status: InviteStatus.ACCEPTED,
      role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });
  return ifExistingUser(staff?.userId);
}
