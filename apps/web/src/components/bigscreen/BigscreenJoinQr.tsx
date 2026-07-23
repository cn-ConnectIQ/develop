"use client";

import { useEffect, useState } from "react";

type BigscreenJoinQrProps = {
  /** 微信小程序码图 URL（优先） */
  wxacodeUrl?: string | null;
  /** 互动扫码 URL（/i/{sessionCode}）或已有 H5 qr 图 */
  scanUrl?: string | null;
  qrUrl?: string | null;
  size?: number;
  caption?: string;
};

/**
 * 大屏右上角参与码：优先小程序码，其次已有 qrUrl，再次根据 scanUrl 生成 H5 码。
 * 同一 URL 不重复换图，避免轮询刷新时二维码闪白。
 */
export function BigscreenJoinQr({
  wxacodeUrl,
  scanUrl,
  qrUrl,
  size = 132,
  caption = "微信扫码参与",
}: BigscreenJoinQrProps) {
  const preferred = wxacodeUrl || qrUrl || null;
  const [dataUrl, setDataUrl] = useState<string | null>(preferred);

  useEffect(() => {
    if (preferred) {
      setDataUrl((prev) => (prev === preferred ? prev : preferred));
      return;
    }
    if (!scanUrl) {
      setDataUrl(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const QRCode = await import("qrcode");
        const url = await QRCode.toDataURL(scanUrl, {
          width: size * 2,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#0b0b14", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl((prev) => (prev === url ? prev : url));
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preferred, scanUrl, size]);

  if (!dataUrl && !scanUrl && !wxacodeUrl) return null;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <div
        className="rounded-xl bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
        style={{ width: size, height: size }}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt={caption}
            className="size-full rounded-lg object-contain"
            decoding="async"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-[10px] text-black/40">
            生成中…
          </div>
        )}
      </div>
      <p className="text-center text-[clamp(11px,1vw,13px)] font-medium text-white/70">
        {caption}
      </p>
    </div>
  );
}
