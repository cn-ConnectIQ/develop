import QRCode from "qrcode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { isQiniuConfigured } from "@/lib/storage/qiniu";
import { storeUploadBuffer } from "@/lib/storage/upload";

const QR_BUCKET = "stamp-qrcodes";
const QR_SIZE = 400;

function getShortLinkOrigin() {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://9li.co";
  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return url.origin;
  } catch {
    return "https://9li.co";
  }
}

/** 章点扫码落地页（H5 / 微信内打开后引导小程序集章） */
export function getStampScanUrl(stampId: string, scanCode: string) {
  const base = getShortLinkOrigin();
  const params = new URLSearchParams({ code: scanCode });
  return `${base}/st/${stampId}?${params.toString()}`;
}

export async function generateStampQRBuffer(
  stampId: string,
  scanCode: string,
): Promise<Buffer> {
  const scanUrl = getStampScanUrl(stampId, scanCode);
  return QRCode.toBuffer(scanUrl, {
    type: "png",
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: "H",
  });
}

export async function generateStampQR(
  stampId: string,
  scanCode: string,
): Promise<string> {
  const scanUrl = getStampScanUrl(stampId, scanCode);
  const pngBuffer = await generateStampQRBuffer(stampId, scanCode);

  if (isQiniuConfigured()) {
    try {
      const stored = await storeUploadBuffer({
        buffer: pngBuffer,
        contentType: "image/png",
        filename: `${stampId}.png`,
        key: `qr/stamp/${stampId}.png`,
      });
      return stored.url;
    } catch (err) {
      console.warn("[stamp-qrcode] 七牛上传失败，尝试降级:", err);
    }
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return QRCode.toDataURL(scanUrl, {
      width: QR_SIZE,
      margin: 2,
      errorCorrectionLevel: "H",
    });
  }

  const path = `${stampId}.png`;
  const { error } = await supabase.storage
    .from(QR_BUCKET)
    .upload(path, pngBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.warn("[stamp-qrcode] 上传失败，使用 data URL:", error.message);
    return QRCode.toDataURL(scanUrl, {
      width: QR_SIZE,
      margin: 2,
      errorCorrectionLevel: "H",
    });
  }

  const { data } = supabase.storage.from(QR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
