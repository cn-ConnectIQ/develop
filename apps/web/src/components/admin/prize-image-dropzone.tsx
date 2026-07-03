"use client";

import { useRef, useState } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type PrizeImageDropzoneProps = {
  imageUrl?: string | null;
  alt?: string;
  onUpload: (url: string) => void;
  compact?: boolean;
  label?: string;
  className?: string;
  disabled?: boolean;
};

/** 大号拖拽上传区（奖品 / 封面图） */
export function PrizeImageDropzone({
  imageUrl,
  alt,
  onUpload,
  compact,
  label = "拖拽图片到此处，或点击上传",
  className,
  disabled,
}: PrizeImageDropzoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    if (disabled) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("上传失败");
      const json = (await res.json()) as { data?: { url?: string }; url?: string };
      const url = json.data?.url ?? json.url;
      if (!url) throw new Error("上传失败");
      onUpload(url);
      toast.success("图片已上传");
    } catch {
      toast.error("图片上传失败");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file?.type.startsWith("image/")) void uploadFile(file);
        }}
        className={cn(
          "flex w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors",
          compact ? "min-h-[120px]" : "min-h-[168px]",
          dragOver
            ? "border-brand-blue bg-brand-blue-light/20"
            : "border-border-light bg-gray-50/80 hover:border-brand-blue/40",
          imageUrl && "border-solid bg-white p-0",
          disabled && "cursor-not-allowed opacity-60",
          className,
        )}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={alt ?? "奖品图片"}
            className="size-full max-h-[220px] object-cover"
          />
        ) : uploading ? (
          <Loader2 className="size-8 animate-spin text-text-muted" />
        ) : (
          <>
            <ImageIcon className="mb-2 size-9 text-text-muted/50" />
            <span className="px-4 text-center text-sm text-text-muted">
              {label}
            </span>
          </>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadFile(file);
        }}
      />
    </>
  );
}
