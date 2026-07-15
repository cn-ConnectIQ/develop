import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  PlatformOrganizationError,
  updatePlatformOrganizationOverdraft,
  updatePlatformOrganizationStatus,
} from "@/lib/platform-organization-service";

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("suspend"),
    remark: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("resume"),
    remark: z.string().max(200).optional(),
  }),
  z.object({
    action: z.literal("set_overdraft"),
    overdraftLimit: z.number().int().min(0).max(100_000),
  }),
]);

export const PATCH = withErrorHandler(async (request, context) => {
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
    if (parsed.data.action === "set_overdraft") {
      const data = await updatePlatformOrganizationOverdraft({
        orgId,
        overdraftLimit: parsed.data.overdraftLimit,
      });
      return createSuccessResponse(data);
    }

    const data = await updatePlatformOrganizationStatus({
      orgId,
      adminStatus: parsed.data.action === "suspend" ? "SUSPENDED" : "APPROVED",
      actorUserId: auth.user.id,
      remark: parsed.data.remark,
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
