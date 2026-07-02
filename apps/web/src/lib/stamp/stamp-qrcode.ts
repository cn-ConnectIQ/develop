import QRCode from "qrcode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const QR_BUCKET = "stamp-qrcodes";
const QR_SIZE = 400;

function getAppBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://app.connectiq.cn"
  ).replace(/\/$/, "");
}

/** 章点扫码落地页（H5 / 微信内打开后引导小程序集章） */
export function getStampScanUrl(stampId: string, scanCode: string) {
  const base = getAppBaseUrl();
  const params = new URLSearchParams({ code: scanCode });
  return `${base}/s/${stampId}?${params.toString()}`;
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
