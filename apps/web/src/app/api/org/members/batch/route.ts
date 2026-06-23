import { MemberTier, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";

const batchSchema = z.object({
  action: z.enum(["notify", "set_tier", "add_tags"]),
  userIds: z.array(z.string()).min(1),
  title: z.string().optional(),
  body: z.string().optional(),
  tier: z.nativeEnum(MemberTier).optional(),
  tags: z.array(z.string()).optional(),
});

export const POST = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) return auth.error;

  const body = await request.json();
  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { action, userIds } = parsed.data;
  const members = await prisma.orgMember.findMany({
    where: { orgId: auth.orgId, userId: { in: userIds } },
  });

  let affected = 0;

  if (action === "notify") {
    if (!parsed.data.title || !parsed.data.body) {
      return createErrorResponse("请填写通知标题和内容", ErrorCode.VALIDATION_ERROR, 400);
    }
    for (const uid of userIds) {
      await prisma.notification.create({
        data: {
          userId: uid,
          title: parsed.data.title,
          body: parsed.data.body,
        },
      });
      affected += 1;
    }
  } else if (action === "set_tier" && parsed.data.tier) {
    const result = await prisma.orgMember.updateMany({
      where: { orgId: auth.orgId, userId: { in: userIds } },
      data: { tier: parsed.data.tier },
    });
    affected = result.count;
  } else if (action === "add_tags" && parsed.data.tags?.length) {
    for (const m of members) {
      const merged = [...new Set([...m.tags, ...parsed.data.tags])];
      await prisma.orgMember.update({
        where: { id: m.id },
        data: { tags: merged },
      });
      affected += 1;
    }
  }

  return createSuccessResponse({ affected });
});
