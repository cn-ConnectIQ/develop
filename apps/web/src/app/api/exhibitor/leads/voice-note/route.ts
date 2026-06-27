import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

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
    return createErrorResponse("语音文件不能超过 10MB", ErrorCode.VALIDATION_ERROR, 400);
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "mp3";
  const filename = `voice-${randomUUID()}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads", "voice");
  await mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  return createSuccessResponse({ url: `/uploads/voice/${filename}` });
});
