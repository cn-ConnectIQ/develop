import { prisma } from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAuth,
  withErrorHandler,
} from "@/lib/api-auth";
import { getRoleHomePath } from "@/lib/role-utils";

const bodySchema = z.object({
  role: z.nativeEnum(UserRole),
  entityId: z.string().nullable().optional(),
});

export const POST = withErrorHandler(async (request) => {
  const { user } = await requireAuth();
  const body = await request.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { role, entityId = null } = parsed.data;

  const assignment = await prisma.userRoleAssignment.findFirst({
    where: {
      userId: user.id,
      role,
      entityId: entityId ?? null,
    },
  });

  if (!assignment) {
    return createErrorResponse("无权切换到该角色", ErrorCode.FORBIDDEN, 403);
  }

  const redirectPath = getRoleHomePath(role, entityId);

  return createSuccessResponse({
    role,
    entityId,
    redirectPath,
  });
});
