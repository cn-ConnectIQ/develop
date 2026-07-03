"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Mentimeter 式内容创建页：大字号 / 大控件 class 集合 */
export const creationStyles = {
  /** 主标题（像文档标题，非表单 Label） */
  titleInput:
    "h-auto min-h-[52px] w-full border-0 border-b border-border-light rounded-none bg-transparent px-0 py-2 text-3xl font-semibold leading-tight shadow-none outline-none transition-colors placeholder:text-text-tertiary/60 focus-visible:border-brand-blue focus-visible:ring-0",
  /** 副标题 / 说明 */
  descriptionInput:
    "min-h-[72px] w-full resize-none border-0 bg-transparent px-0 py-2 text-lg leading-relaxed text-text-secondary shadow-none outline-none placeholder:text-text-tertiary focus-visible:ring-0",
  /** 区块小标题（弱化步骤感，仅作分组提示） */
  sectionHint: "text-sm font-medium text-text-muted",
  sectionDesc: "text-sm text-text-tertiary",
  /** 选项行大控件 */
  optionInput:
    "h-12 flex-1 border-0 bg-transparent text-lg shadow-none outline-none placeholder:text-text-tertiary focus-visible:ring-0",
  optionRow: "group flex min-h-12 items-center gap-3 rounded-xl px-1 transition-colors hover:bg-content-bg/80",
  /** 单选卡片 */
  choiceCard:
    "flex cursor-pointer items-start gap-4 rounded-xl border-2 px-5 py-4 transition-colors",
  choiceCardActive: "border-brand-blue bg-brand-blue-light/15",
  choiceCardIdle: "border-border-light hover:border-border-default",
};

export type CreationSectionProps = {
  hint?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** 文档式分组：无 Card 边框，大留白向下流动 */
export function CreationSection({
  hint,
  description,
  children,
  className,
}: CreationSectionProps) {
  return (
    <section className={cn("space-y-5 py-10 first:pt-2", className)}>
      {(hint || description) && (
        <div className="space-y-1">
          {hint ? (
            <p className={creationStyles.sectionHint}>{hint}</p>
          ) : null}
          {description ? (
            <p className={creationStyles.sectionDesc}>{description}</p>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}

export type ContentCreationPreviewPanelProps = {
  children: ReactNode;
  label?: string;
  className?: string;
};

export function ContentCreationPreviewPanel({
  children,
  label = "实时预览",
  className,
}: ContentCreationPreviewPanelProps) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 border-l border-border-light bg-content-bg/40 lg:flex lg:w-[380px] lg:flex-col",
        className,
      )}
    >
      <div className="sticky top-0 flex max-h-[calc(100vh-56px)] flex-col overflow-y-auto px-6 py-8">
        <p className="mb-6 text-xs font-medium uppercase tracking-widest text-text-muted">
          {label}
        </p>
        {children}
      </div>
    </aside>
  );
}

export type ContentCreationLayoutProps = {
  editor: ReactNode;
  preview: ReactNode;
  previewLabel?: string;
  className?: string;
};

/**
 * Mentimeter 式左右分栏：左编辑（大留白）+ 右预览（常驻）
 * 适用于投票/问答/抽奖等「一件事的配置」页面
 */
export function ContentCreationLayout({
  editor,
  preview,
  previewLabel,
  className,
}: ContentCreationLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-[calc(100vh-120px)] flex-1 flex-col lg:flex-row",
        className,
      )}
    >
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-8 sm:px-10 lg:max-w-2xl lg:px-12 lg:pr-16">
        {editor}
      </div>
      <ContentCreationPreviewPanel label={previewLabel}>
        {preview}
      </ContentCreationPreviewPanel>
    </div>
  );
}
