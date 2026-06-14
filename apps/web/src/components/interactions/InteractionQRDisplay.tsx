"use client";

import { Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InteractionQRDisplayProps = {
  sessionCode: string;
  qrUrl: string;
  interactionTitle: string;
  className?: string;
  showActions?: boolean;
};

export function InteractionQRDisplay({
  sessionCode,
  qrUrl,
  interactionTitle,
  className,
  showActions = true,
}: InteractionQRDisplayProps) {
  const scanPath = `/i/${sessionCode}`;

  function downloadQr() {
    const link = document.createElement("a");
    link.href = qrUrl;
    link.download = `${interactionTitle}-二维码.png`;
    link.click();
  }

  async function copyLink() {
    const url = `${window.location.origin}${scanPath}`;
    await navigator.clipboard.writeText(url);
    toast.success("链接已复制");
  }

  return (
    <div
      className={cn(
        "interaction-qr-display rounded-xl border border-border-light bg-white p-5",
        className,
      )}
    >
      <p className="font-semibold">{interactionTitle}</p>
      <div className="mt-4 flex justify-center print:mt-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl}
          alt={`${interactionTitle} 二维码`}
          className="size-[200px] rounded-xl bg-white object-contain print:size-[320px]"
        />
      </div>
      <p className="mt-3 text-center font-mono text-sm text-brand-amber">
        {scanPath}
      </p>
      <p className="mt-1 text-center text-xs text-text-muted print:hidden">
        扫码参与，或手动输入上方短码
      </p>

      {showActions && (
        <div className="mt-4 flex gap-3 print:hidden">
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 rounded-xl"
            onClick={downloadQr}
          >
            <Download className="mr-1.5 size-4" />
            下载
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 flex-1 rounded-xl"
            onClick={() => void copyLink()}
          >
            <Copy className="mr-1.5 size-4" />
            复制链接
          </Button>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .interaction-qr-display,
          .interaction-qr-display * {
            visibility: visible;
          }
          .interaction-qr-display {
            position: fixed;
            inset: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: none;
            box-shadow: none;
          }
        }
      `}</style>
    </div>
  );
}
