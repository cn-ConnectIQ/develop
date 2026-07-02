import { prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
  type AuthSession,
} from "@/lib/api-auth";
import {
  createBoothInteraction,
  listBoothInteractions,
} from "@/lib/exhibitor/booth-interaction-service";
import { requireExhibitorAdmin } from "@/lib/exhibitor/exhibitor-auth";
import { createBoothInteractionSchema } from "@/lib/interaction/schemas";
import { guardEventFeature } from "@/lib/event-feature-flag-guard";

const createExhibitorInteractionSchema = createBoothInteractionSchema.and(
  z.object({
    booth_id: z.string().cuid().optional(),
  }),
);

async function resolveAuthSession(
  session: Session | undefined,
  userId: string | undefined,
  orgId: string,
): Promise<AuthSession> {
  if (session) return session as AuthSession;
  if (!userId) {
    throw new ApiError("未登录", ErrorCode.UNAUTHORIZED, 401);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      userType: true,
      orgId: true,
    },
  });
  if (!user) {
    throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  return {
    user: {
      id: user.id,
      name: user.name ?? "",
      email: user.email ?? "",
      role: UserRole.EXHIBITOR,
      userType: user.userType,
      activeOrgId: orgId ?? user.orgId ?? undefined,
    },
    expires: new Date(Date.now() + 86_400_000).toISOString(),
  } as AuthSession;
}

/** 小程序 · 展位互动（与 dashboard-stats 相同鉴权） */
export const GET = withErrorHandler(async (request) => {
  const { booth } = await requireExhibitorAdmin(request);
  const url = new URL(request.url);
  const boothId = url.searchParams.get("boothId")?.trim() || booth.id;
  if (boothId !== booth.id) {
    throw new ApiError("无权访问该展位", ErrorCode.FORBIDDEN, 403);
  }
  const interactions = await listBoothInteractions(boothId);
  return createSuccessResponse(interactions, { total: interactions.length });
});

export const POST = withErrorHandler(async (request) => {
  const { session, userId, orgId, booth: exhibitorBooth } =
    await requireExhibitorAdmin(request);
  const body = await request.json();
  const parsed = createExhibitorInteractionSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const boothId = parsed.data.booth_id?.trim() || exhibitorBooth.id;
  if (boothId !== exhibitorBooth.id) {
    throw new ApiError("无权操作该展位", ErrorCode.FORBIDDEN, 403);
  }

  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      eventId: true,
      companyOrgId: true,
    },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const { booth_id: _boothId, ...payload } = parsed.data;
  if (payload.kind === "lottery") {
    const disabled = await guardEventFeature(booth.eventId, "lottery");
    if (disabled) return disabled;
  }

  const authSession = await resolveAuthSession(session, userId, orgId);
  const result = await createBoothInteraction(
    { id: booth.id, eventId: booth.eventId, companyOrgId: booth.companyOrgId },
    authSession,
    payload,
  );
  return createSuccessResponse(result);
});
