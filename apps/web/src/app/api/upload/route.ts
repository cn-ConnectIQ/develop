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

const EXT_TO_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** 微信小程序 uploadFile 常把 Content-Type 标成 octet-stream / 空，需按扩展名或魔数回退 */
function resolveImageContentType(file: File, buffer: Buffer): string | null {
  const rawType = (file.type || "").toLowerCase().trim();
  if (ALLOWED_TYPES.has(rawType)) {
    return rawType === "image/jpg" ? "image/jpeg" : rawType;
  }

  const ext = (file.name || "").split(".").pop()?.toLowerCase() ?? "";
  if (ext && EXT_TO_MIME[ext]) return EXT_TO_MIME[ext];

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46
  ) {
    return "image/gif";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

export const POST = withErrorHandler(async (request) => {
  await resolveMobileUserId(request);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return createErrorResponse("请上传文件", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (file.size > MAX_BYTES) {
    return createErrorResponse("图片不能超过 5MB", ErrorCode.VALIDATION_ERROR, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const contentType = resolveImageContentType(file, buffer);
  if (!contentType) {
    return createErrorResponse(
      "仅支持 PNG、JPG、WebP、GIF 图片",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const filename =
    file.name && /\.[a-z0-9]+$/i.test(file.name)
      ? file.name
      : `upload.${contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg"}`;

  try {
    const stored = await storeUploadBuffer({
      buffer,
      contentType,
      filename,
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
