import QRCode from "qrcode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

const QR_BUCKET = "interaction-qrcodes";
const QR_SIZE = 400;

function getInteractionScanUrl(sessionCode: string) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    "https://app.connectiq.cn";
  return `${base.replace(/\/$/, "")}/i/${sessionCode}`;
}

/** 生成 PNG Buffer（400×400，纠错级别 H） */
export async function generateInteractionQRBuffer(
  sessionCode: string,
): Promise<Buffer> {
  const scanUrl = getInteractionScanUrl(sessionCode);
  return QRCode.toBuffer(scanUrl, {
    type: "png",
    width: QR_SIZE,
    margin: 2,
    errorCorrectionLevel: "H",
  });
}

/**
 * 生成互动二维码并上传到 Supabase Storage，返回公开 URL。
 * 若 Storage 未配置则降级为 data URL。
 */
export async function generateInteractionQR(
  sessionCode: string,
): Promise<string> {
  const scanUrl = getInteractionScanUrl(sessionCode);
  const pngBuffer = await generateInteractionQRBuffer(sessionCode);

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return QRCode.toDataURL(scanUrl, {
      width: QR_SIZE,
      margin: 2,
      errorCorrectionLevel: "H",
    });
  }

  const path = `${sessionCode}.png`;
  const { error } = await supabase.storage
    .from(QR_BUCKET)
    .upload(path, pngBuffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.warn("[qrcode] 上传失败，使用 data URL:", error.message);
    return QRCode.toDataURL(scanUrl, {
      width: QR_SIZE,
      margin: 2,
      errorCorrectionLevel: "H",
    });
  }

  const { data } = supabase.storage.from(QR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export { getInteractionScanUrl };
