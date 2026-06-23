import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { prisma } from "@connectiq/database";

const notifySchema = z.object({
  userId: z.string(),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
});

export const POST = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = notifySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const member = await prisma.orgMember.findFirst({
    where: { orgId: auth.orgId, userId: parsed.data.userId },
  });
  if (!member) {
    return createErrorResponse("用户不在组织池中", ErrorCode.NOT_FOUND, 404);
  }

  await prisma.notification.create({
    data: {
      userId: parsed.data.userId,
      title: parsed.data.title,
      body: parsed.data.body,
    },
  });

  return createSuccessResponse({ sent: true });
});
