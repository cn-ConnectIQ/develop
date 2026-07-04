"use client";

import { useEffect, useState } from "react";
import { buildQrContent } from "@/lib/screen-pairing/shared";

type QRDisplayProps = {
  pairingToken: string;
  qrContent?: string;
};

export function QRDisplay({ pairingToken, qrContent }: QRDisplayProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const content = qrContent ?? buildQrContent(pairingToken);

  useEffect(() => {
    let cancelled = false;
    setDataUrl(null);
    setError(null);

    void (async () => {
      try {
        const QRCode = await import("qrcode");
        const url = await QRCode.toDataURL(content, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 640,
          color: { dark: "#111827", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) {
          setError("二维码生成失败，请刷新页面重试");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [content, pairingToken]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        maxWidth: "720px",
        margin: "0 auto",
      }}
    >
      <div
        style={{
          width: "min(72vw, 560px)",
          height: "min(72vw, 560px)",
          backgroundColor: "#ffffff",
          borderRadius: "24px",
          padding: "24px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="大屏配对二维码"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              color: "#6b7280",
              fontSize: "18px",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            {error ?? "正在生成二维码…"}
          </div>
        )}
      </div>

      <p
        style={{
          marginTop: "32px",
          maxWidth: "640px",
          textAlign: "center",
          fontSize: "clamp(18px, 2.4vw, 28px)",
          lineHeight: 1.6,
          color: "rgba(255,255,255,0.82)",
          fontWeight: 500,
        }}
      >
        打开 ConnectIQ 小程序，发起互动时扫描此码连接大屏
      </p>
    </div>
  );
}
