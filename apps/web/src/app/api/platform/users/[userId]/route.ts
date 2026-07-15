import { prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { getPlatformUserDetail } from "@/lib/platform-data";

export const GET = withErrorHandler(async (_request, context) => {
  await requirePlatformAdmin();
  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const detail = await getPlatformUserDetail(userId);
  if (!detail) {
    return createErrorResponse("用户不存在", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(detail);
});

const roleSchema = z.object({
  role: z.string(),
  entityId: z.string().nullable().optional(),
  action: z.enum(["revoke", "assign"]),
});

export const PATCH = withErrorHandler(async (request, context) => {
  await requirePlatformAdmin();
  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json();
  const parsed = roleSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (parsed.data.action === "revoke") {
    await prisma.userRoleAssignment.deleteMany({
      where: {
        userId,
        role: parsed.data.role as never,
        entityId: parsed.data.entityId ?? null,
      },
    });
    if (parsed.data.role === "PLATFORM_ADMIN") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { orgId: true },
      });
      await prisma.user.update({
        where: { id: userId },
        data: {
          userType: user?.orgId ? "ACCOUNT_ADMIN" : "END_USER",
        },
      });
    }
  }

  if (parsed.data.action === "assign" && parsed.data.role === "PLATFORM_ADMIN") {
    const existing = await prisma.userRoleAssignment.findFirst({
      where: { userId, role: "PLATFORM_ADMIN" as never },
    });
    if (!existing) {
      await prisma.userRoleAssignment.create({
        data: { userId, role: "PLATFORM_ADMIN" as never },
      });
    }
    await prisma.user.update({
      where: { id: userId },
      data: { userType: "PLATFORM_ADMIN" },
    });
  }

  return createSuccessResponse({ updated: true });
});
