import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  createHostExhibitorDirectoryEntry,
  listHostExhibitorDirectory,
} from "@/lib/host-exhibitor-directory-service";

const createSchema = z.object({
  companyName: z.string().min(1, "请填写企业名称").max(80),
  contactName: z.string().max(64).optional().nullable(),
  contactPhone: z.string().max(32).optional().nullable(),
  contactEmail: z.string().max(120).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
});

export const GET = withErrorHandler(async () => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  const items = await listHostExhibitorDirectory(result.orgId);
  return createSuccessResponse({ items });
});

export const POST = withErrorHandler(async (request) => {
  const result = await requireAccountAdmin();
  if ("error" in result) return result.error;

  const body = await request.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  try {
    const item = await createHostExhibitorDirectoryEntry(result.orgId, parsed.data);
    return createSuccessResponse(item);
  } catch (err) {
    return createErrorResponse(
      err instanceof Error ? err.message : "创建失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
});
