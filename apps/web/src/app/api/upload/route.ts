import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { storeUploadBuffer } from "@/lib/storage/upload";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export const POST = withErrorHandler(async (request) => {
  await resolveMobileUserId(request);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return createErrorResponse("请上传文件", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return createErrorResponse(
      "仅支持 PNG、JPG、WebP、GIF 图片",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  if (file.size > MAX_BYTES) {
    return createErrorResponse("图片不能超过 5MB", ErrorCode.VALIDATION_ERROR, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const stored = await storeUploadBuffer({
      buffer,
      contentType: file.type,
      filename: file.name || undefined,
      prefix: "uploads",
    });
    return createSuccessResponse({
      url: stored.url,
      key: stored.key,
      storage: stored.storage,
    });
  } catch (err) {
    console.error("[upload]", err);
    return createErrorResponse(
      err instanceof Error ? err.message : "上传失败",
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }
});
