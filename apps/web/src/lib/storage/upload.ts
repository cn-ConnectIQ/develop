import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { withPublicPath } from "@/lib/public-path";
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

function allowLocalUploadFallback(): boolean {
  // 生产容器盘不持久，且 /uploads 无 basePath 会打到域名根 COS → 禁止静默落本地
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.ALLOW_LOCAL_UPLOAD === "1") return true;
  if (process.env.ALLOW_LOCAL_UPLOAD === "0") return false;
  return true;
}

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

  if (!allowLocalUploadFallback()) {
    throw new Error(
      "生产环境未配置七牛：请在 CloudBase 云托管环境变量中设置 QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET / QINIU_CDN_DOMAIN 后重新发布",
    );
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
  const relativeUrl = `/${key.replace(/\\/g, "/")}`;
  // 带 basePath（如 /uc/uploads/...），避免浏览器请求落到 https://9li.co/uploads
  return {
    url: withPublicPath(relativeUrl),
    key,
    storage: "local",
  };
}
