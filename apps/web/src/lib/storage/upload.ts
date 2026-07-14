import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import {
  isQiniuConfigured,
  uploadBufferToQiniu,
} from "@/lib/storage/qiniu";

export type StoredFile = {
  url: string;
  key: string;
  /** qiniu | local */
  storage: "qiniu" | "local";
};

/**
 * 统一上传入口：已配置七牛则上传到 CDN（cdn.9li.cn），否则本地 public/uploads（仅开发兜底）。
 */
export async function storeUploadBuffer(input: {
  buffer: Buffer;
  contentType?: string;
  filename?: string;
  /** 路径前缀，如 uploads / uploads/voice / qr/interaction */
  prefix?: string;
  /** 固定 key（覆盖自动生成），如 interaction/{code}.png */
  key?: string;
}): Promise<StoredFile> {
  if (isQiniuConfigured()) {
    const result = await uploadBufferToQiniu({
      buffer: input.buffer,
      contentType: input.contentType,
      filename: input.filename,
      prefix: input.prefix ?? "uploads",
      key: input.key,
    });
    return { url: result.url, key: result.key, storage: "qiniu" };
  }

  const prefix = (input.prefix ?? "uploads").replace(/^\/+|\/+$/g, "");
  const ext =
    input.filename?.split(".").pop()?.toLowerCase() ||
    input.contentType?.split("/")[1]?.replace("jpeg", "jpg") ||
    "bin";
  const name = input.key?.split("/").pop() || `${randomUUID()}.${ext}`;
  const relativeDir = prefix.split("/").join(path.sep);
  const uploadsDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(uploadsDir, { recursive: true });
  await writeFile(path.join(uploadsDir, name), input.buffer);
  const key = input.key ?? `${prefix}/${name}`;
  return { url: `/${key.replace(/\\/g, "/")}`, key, storage: "local" };
}
