import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  deleteHostExhibitorDirectoryEntry,
  updateHostExhibitorDirectoryEntry,
} from "@/lib/host-exhibitor-directory-service";

const updateSchema = z.object({
  companyName: z.string().min(1).max(80).optional(),
  contactName: z.string().max(64).optional().nullable(),
  contactPhone: z.string().max(32).optional().nullable(),
  contactEmail: z.string().max(120).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const PATCH = withErrorHandler(async (request, context) => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const item = await updateHostExhibitorDirectoryEntry(
      result.orgId,
      id,
      parsed.data,
    );
    return createSuccessResponse(item);
  } catch (err) {
    return createErrorResponse(
      err instanceof Error ? err.message : "更新失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
});

export const DELETE = withErrorHandler(async (_request, context) => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  const id = context?.params?.id;
  if (!id) {
    return createErrorResponse("缺少 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    await deleteHostExhibitorDirectoryEntry(result.orgId, id);
    return createSuccessResponse({ deleted: true });
  } catch (err) {
    return createErrorResponse(
      err instanceof Error ? err.message : "删除失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
});
