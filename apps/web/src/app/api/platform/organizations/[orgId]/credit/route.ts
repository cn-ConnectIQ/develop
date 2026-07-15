import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  creditPlatformOrganization,
  PlatformOrganizationError,
} from "@/lib/platform-organization-service";

const schema = z.object({
  resource: z.enum(["SMS", "EMAIL", "INTERACTION_POINT"]),
  amount: z.number().int().positive(),
  remark: z.string().min(2).max(200),
});

export const POST = withErrorHandler(async (request, context) => {
  const auth = await requirePlatformAdmin();
  const orgId = context?.params?.orgId;
  if (!orgId) {
    return createErrorResponse("缺少组织 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    const data = await creditPlatformOrganization({
      orgId,
      ...parsed.data,
      actorUserId: auth.user.id,
    });
    return createSuccessResponse(data);
  } catch (e) {
    if (e instanceof PlatformOrganizationError) {
      const status = e.code === "NOT_FOUND" ? 404 : 400;
      return createErrorResponse(e.message, ErrorCode.VALIDATION_ERROR, status);
    }
    throw e;
  }
});
