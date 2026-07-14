import { randomUUID } from "crypto";
import * as qiniu from "qiniu";

export type QiniuConfig = {
  accessKey: string;
  secretKey: string;
  bucket: string;
  /** 例如 https://cdn.9li.cn（不要尾斜杠） */
  cdnBaseUrl: string;
  /** z0 华东 / z1 华北 / z2 华南 / na0 北美 / as0 亚太；不填则自动 */
  region?: string;
};

export function getQiniuConfig(): QiniuConfig | null {
  const accessKey = process.env.QINIU_ACCESS_KEY?.trim() ?? "";
  const secretKey = process.env.QINIU_SECRET_KEY?.trim() ?? "";
  const bucket = process.env.QINIU_BUCKET?.trim() ?? "";
  const cdn =
    process.env.QINIU_CDN_DOMAIN?.trim() ||
    process.env.NEXT_PUBLIC_CDN_URL?.trim() ||
    "";
  if (!accessKey || !secretKey || !bucket || !cdn) return null;

  const cdnBaseUrl = cdn.startsWith("http")
    ? cdn.replace(/\/$/, "")
    : `https://${cdn.replace(/\/$/, "")}`;

  return {
    accessKey,
    secretKey,
    bucket,
    cdnBaseUrl,
    region: process.env.QINIU_REGION?.trim() || undefined,
  };
}

export function isQiniuConfigured(): boolean {
  return getQiniuConfig() !== null;
}

/** 公开访问 URL：cdn.9li.cn/{key} */
export function publicCdnUrl(key: string, cfg = getQiniuConfig()): string {
  if (!cfg) throw new Error("七牛未配置");
  const path = key.replace(/^\//, "");
  return `${cfg.cdnBaseUrl}/${path}`;
}

function mac(cfg: QiniuConfig) {
  return new qiniu.auth.digest.Mac(cfg.accessKey, cfg.secretKey);
}

function buildConfig(cfg: QiniuConfig) {
  const conf = new qiniu.conf.Config();
  // 优先使用加速上传域名；区域可选
  conf.useCdnDomain = true;
  const regionMap: Record<string, typeof qiniu.zone.Zone_z0 | undefined> = {
    z0: qiniu.zone.Zone_z0,
    z1: qiniu.zone.Zone_z1,
    z2: qiniu.zone.Zone_z2,
    na0: qiniu.zone.Zone_na0,
    as0: qiniu.zone.Zone_as0,
  };
  if (cfg.region && regionMap[cfg.region]) {
    conf.zone = regionMap[cfg.region];
  }
  return conf;
}

function uploadToken(cfg: QiniuConfig, key: string, expiresSec = 3600) {
  const options = {
    scope: `${cfg.bucket}:${key}`,
    expires: expiresSec,
  };
  const putPolicy = new qiniu.rs.PutPolicy(options);
  return putPolicy.uploadToken(mac(cfg));
}

export type UploadResult = {
  key: string;
  url: string;
  hash?: string;
};

/**
 * 上传 Buffer 到七牛，返回 CDN 公网 URL（cdn.9li.cn）
 */
export async function uploadBufferToQiniu(input: {
  buffer: Buffer;
  key?: string;
  /** 默认 uploads/ */
  prefix?: string;
  contentType?: string;
  filename?: string;
}): Promise<UploadResult> {
  const cfg = getQiniuConfig();
  if (!cfg) {
    throw new Error(
      "七牛未配置：需 QINIU_ACCESS_KEY / QINIU_SECRET_KEY / QINIU_BUCKET / QINIU_CDN_DOMAIN",
    );
  }

  const prefix = (input.prefix ?? "uploads").replace(/^\/+|\/+$/g, "");
  const ext =
    input.filename?.split(".").pop()?.toLowerCase() ||
    input.contentType?.split("/")[1]?.replace("jpeg", "jpg") ||
    "bin";
  const key = input.key ?? `${prefix}/${randomUUID()}.${ext}`;

  const token = uploadToken(cfg, key);
  const formUploader = new qiniu.form_up.FormUploader(buildConfig(cfg));
  const putExtra = new qiniu.form_up.PutExtra();
  if (input.contentType) {
    putExtra.mimeType = input.contentType;
  }

  const { data, resp } = await formUploader.put(
    token,
    key,
    input.buffer,
    putExtra,
  );

  if (resp.statusCode !== 200) {
    throw new Error(
      `七牛上传失败 HTTP ${resp.statusCode}: ${JSON.stringify(data)}`,
    );
  }

  return {
    key: (data as { key?: string })?.key ?? key,
    url: publicCdnUrl(key, cfg),
    hash: (data as { hash?: string })?.hash,
  };
}

/** 配置状态（不含密钥） */
export function getQiniuStatus() {
  const cfg = getQiniuConfig();
  return {
    configured: Boolean(cfg),
    bucket: cfg?.bucket,
    cdnBaseUrl: cfg?.cdnBaseUrl,
    region: cfg?.region ?? "auto",
    missing: [
      !process.env.QINIU_ACCESS_KEY?.trim() && "QINIU_ACCESS_KEY",
      !process.env.QINIU_SECRET_KEY?.trim() && "QINIU_SECRET_KEY",
      !process.env.QINIU_BUCKET?.trim() && "QINIU_BUCKET",
      !(
        process.env.QINIU_CDN_DOMAIN?.trim() ||
        process.env.NEXT_PUBLIC_CDN_URL?.trim()
      ) && "QINIU_CDN_DOMAIN",
    ].filter(Boolean) as string[],
  };
}
