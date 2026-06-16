import { MemberTier } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getOrgMemberDetail,
  removeOrgMember,
  updateOrgMember,
} from "@/lib/org-member-service";

const patchSchema = z.object({
  tier: z.nativeEnum(MemberTier).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().nullable().optional(),
});

export const GET = withErrorHandler(async (_request, context) => {
  const auth = await requireAccountAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const detail = await getOrgMemberDetail(auth.orgId, userId);
  if (!detail) {
    return createErrorResponse("用户不在用户池中", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse(detail);
});

export const PATCH = withErrorHandler(async (request, context) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const updated = await updateOrgMember(auth.orgId, userId, parsed.data);
  if (!updated) {
    return createErrorResponse("用户不在用户池中", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({ ok: true });
});

export const DELETE = withErrorHandler(async (_request, context) => {
  const auth = await requireAccountAdmin();
  if ("error" in auth) {
    return auth.error;
  }

  const userId = context?.params?.userId;
  if (!userId) {
    return createErrorResponse("缺少用户 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const removed = await removeOrgMember(auth.orgId, userId);
  if (!removed) {
    return createErrorResponse("用户不在用户池中", ErrorCode.NOT_FOUND, 404);
  }

  return createSuccessResponse({ ok: true });
});
