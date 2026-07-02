import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { collectStampById } from "@/lib/stamp/stamp-collect-service";

const bodySchema = z.object({
  code: z.string().optional(),
});

/** 扫码 / 按钮打卡：收集指定章印 */
export const POST = withErrorHandler(async (request, context) => {
  const stampId = context?.params?.stampId;
  if (!stampId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await collectStampById(stampId, userId, parsed.data.code);
  return createSuccessResponse(result);
});
