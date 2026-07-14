import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import { storeUploadBuffer } from "@/lib/storage/upload";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/aac",
  "audio/mp4",
  "audio/m4a",
  "audio/amr",
  "audio/silk",
  "application/octet-stream",
]);

/** 展商语音备注上传 */
export const POST = withErrorHandler(async (request) => {
  await resolveMobileUserId(request);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return createErrorResponse("请上传语音文件", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return createErrorResponse("不支持的语音格式", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (file.size > MAX_BYTES) {
    return createErrorResponse(
      "语音文件不能超过 10MB",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    const stored = await storeUploadBuffer({
      buffer,
      contentType: file.type || "audio/mpeg",
      filename: file.name || "voice.mp3",
      prefix: "uploads/voice",
    });
    return createSuccessResponse({
      url: stored.url,
      key: stored.key,
      storage: stored.storage,
    });
  } catch (err) {
    console.error("[voice-note upload]", err);
    return createErrorResponse(
      err instanceof Error ? err.message : "上传失败",
      ErrorCode.INTERNAL_ERROR,
      500,
    );
  }
});
