import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { moderateItem } from "@/lib/moderation-service";

const patchSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

export const PATCH = withErrorHandler(async (request, context) => {
  await requirePlatformAdmin();
  const itemId = decodeURIComponent(context?.params?.itemId ?? "");
  if (!itemId) {
    return createErrorResponse("缺少条目 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  const body = await request.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }
  try {
    await moderateItem(itemId, parsed.data.action);
    return createSuccessResponse({ ok: true });
  } catch (e) {
    return createErrorResponse(
      e instanceof Error ? e.message : "审核失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }
});
