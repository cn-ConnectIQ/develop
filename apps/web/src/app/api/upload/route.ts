import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export const POST = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

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

  const ext = file.type.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
  const filename = `${randomUUID()}.${ext}`;
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadsDir, filename), buffer);

  return createSuccessResponse({ url: `/uploads/${filename}` });
});
