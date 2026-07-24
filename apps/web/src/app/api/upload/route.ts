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

function normalizeMime(raw: string | null | undefined): string | null {
  const type = (raw || "").toLowerCase().trim();
  if (!type) return null;
  if (ALLOWED_TYPES.has(type)) {
    return type === "image/jpg" ? "image/jpeg" : type;
  }
  return null;
}

/** 微信小程序 uploadFile 常把 Content-Type 标成 octet-stream / 空，需按扩展名或魔数回退 */
function resolveImageContentType(
  buffer: Buffer,
  opts?: { mime?: string | null; filename?: string | null },
): string | null {
  const fromMime = normalizeMime(opts?.mime ?? undefined);
  if (fromMime) return fromMime;

  const ext = (opts?.filename || "").split(".").pop()?.toLowerCase() ?? "";
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

function stripDataUrlPrefix(raw: string): string {
  const trimmed = raw.trim();
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma >= 0) {
    return trimmed.slice(comma + 1);
  }
  return trimmed;
}

async function storeAndRespond(input: {
  buffer: Buffer;
  contentType: string;
  filename: string;
}) {
  try {
    const stored = await storeUploadBuffer({
      buffer: input.buffer,
      contentType: input.contentType,
      filename: input.filename,
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
}

/** JSON：小程序读本地文件转 base64 后走 request，避开 uploadFile multipart 兼容问题 */
async function handleJsonUpload(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    image_base64?: unknown;
    data?: unknown;
    filename?: unknown;
    content_type?: unknown;
    contentType?: unknown;
  } | null;

  const rawBase64 =
    typeof body?.image_base64 === "string"
      ? body.image_base64
      : typeof body?.data === "string"
        ? body.data
        : "";
  if (!rawBase64.trim()) {
    return createErrorResponse("请上传图片数据", ErrorCode.VALIDATION_ERROR, 400);
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(stripDataUrlPrefix(rawBase64), "base64");
  } catch {
    return createErrorResponse("图片数据无效", ErrorCode.VALIDATION_ERROR, 400);
  }

  if (!buffer.length) {
    return createErrorResponse("图片数据无效", ErrorCode.VALIDATION_ERROR, 400);
  }
  if (buffer.length > MAX_BYTES) {
    return createErrorResponse("图片不能超过 5MB", ErrorCode.VALIDATION_ERROR, 400);
  }

  const filename =
    typeof body?.filename === "string" && body.filename.trim()
      ? body.filename.trim()
      : "upload.jpg";
  const mimeHint =
    typeof body?.content_type === "string"
      ? body.content_type
      : typeof body?.contentType === "string"
        ? body.contentType
        : null;

  const contentType = resolveImageContentType(buffer, {
    mime: mimeHint,
    filename,
  });
  if (!contentType) {
    return createErrorResponse(
      "仅支持 PNG、JPG、WebP、GIF 图片",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const safeName = /\.[a-z0-9]+$/i.test(filename)
    ? filename
    : `upload.${contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg"}`;

  return storeAndRespond({
    buffer,
    contentType,
    filename: safeName,
  });
}

/** multipart：兼容 File / Blob（微信 uploadFile 在部分运行时不是 File） */
async function handleMultipartUpload(request: Request) {
  const form = await request.formData();
  const file = form.get("file");

  // 微信 → Next 时常见：是 Blob 但 instanceof File === false
  const isBlob =
    file != null &&
    typeof file === "object" &&
    typeof (file as Blob).arrayBuffer === "function";
  if (typeof file === "string" || !isBlob) {
    return createErrorResponse("请上传文件", ErrorCode.VALIDATION_ERROR, 400);
  }

  const blob = file as Blob & { name?: string; type?: string };
  if (blob.size > MAX_BYTES) {
    return createErrorResponse("图片不能超过 5MB", ErrorCode.VALIDATION_ERROR, 400);
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const filenameHint =
    typeof blob.name === "string" && blob.name.trim() ? blob.name : "upload.jpg";
  const contentType = resolveImageContentType(buffer, {
    mime: blob.type,
    filename: filenameHint,
  });
  if (!contentType) {
    return createErrorResponse(
      "仅支持 PNG、JPG、WebP、GIF 图片",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const filename = /\.[a-z0-9]+$/i.test(filenameHint)
    ? filenameHint
    : `upload.${contentType.split("/")[1]?.replace("jpeg", "jpg") || "jpg"}`;

  return storeAndRespond({ buffer, contentType, filename });
}

export const POST = withErrorHandler(async (request) => {
  await resolveMobileUserId(request);

  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return handleJsonUpload(request);
  }
  return handleMultipartUpload(request);
});
