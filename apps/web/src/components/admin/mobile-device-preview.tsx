"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MobileDevicePreviewProps = {
  children: ReactNode;
  label?: string;
  /** 设备框宽度，默认 280 */
  width?: number;
  className?: string;
  dark?: boolean;
};

/** Mentimeter 式手机预览框（内容创建页右侧常驻） */
export function MobileDevicePreview({
  children,
  label = "参会者看到的效果",
  width = 280,
  className,
  dark = false,
}: MobileDevicePreviewProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      {label ? (
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-text-muted">
          {label}
        </p>
      ) : null}
      <div
        className={cn(
          "overflow-hidden rounded-[2rem] border-[10px] shadow-2xl",
          dark ? "border-gray-900 bg-[#0a0a12]" : "border-gray-800 bg-white",
        )}
        style={{ width }}
      >
        <div
          className={cn(
            "flex justify-center py-2",
            dark ? "bg-gray-900" : "bg-gray-800",
          )}
        >
          <div className="h-1 w-14 rounded-full bg-gray-600" />
        </div>
        <div
          className={cn(
            "max-h-[min(640px,calc(100vh-220px))] overflow-y-auto",
            dark ? "p-4 text-white" : "p-5",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
