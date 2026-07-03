"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type InteractionEditLayoutProps = {
  editor: ReactNode;
  preview: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** 互动创建页：左 55% 编辑 + 右 45% 吸顶预览（#F7F7F5 背景） */
export function InteractionEditLayout({
  editor,
  preview,
  footer,
  className,
}: InteractionEditLayoutProps) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col overflow-hidden", className)}>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="min-w-0 flex-[11] overflow-y-auto bg-white px-8 py-8 sm:px-10 lg:px-12">
          {editor}
        </div>
        <aside className="hidden min-w-0 flex-[9] flex-col overflow-y-auto bg-[#F7F7F5] px-6 py-8 lg:flex lg:sticky lg:top-0 lg:max-h-[calc(100vh-56px)]">
          <p className="mb-5 text-xs text-text-muted">参会者看到的样子</p>
          <div className="flex flex-1 flex-col">{preview}</div>
        </aside>
      </div>
      {footer ? (
        <div className="shrink-0 border-t border-border-light bg-white px-8 py-4 sm:px-10 lg:px-12">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
