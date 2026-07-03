"use client";

import { Button } from "@/components/ui/button";

export type LotteryCreationFooterProps = {
  onSaveDraft: () => void;
  onPublish: () => void;
  saving?: boolean;
  savingDraft?: boolean;
  publishLabel?: string;
  hideDraft?: boolean;
};

export function LotteryCreationFooter({
  onSaveDraft,
  onPublish,
  saving,
  savingDraft,
  publishLabel = "发布",
  hideDraft,
}: LotteryCreationFooterProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      {hideDraft ? (
        <span />
      ) : (
        <button
          type="button"
          disabled={saving || savingDraft}
          onClick={onSaveDraft}
          className="text-base text-text-muted hover:text-text-primary disabled:opacity-50"
        >
          {savingDraft ? "保存中…" : "保存草稿"}
        </button>
      )}
      <Button
        size="lg"
        disabled={saving || savingDraft}
        onClick={onPublish}
        className="h-12 min-w-[140px] bg-brand-green text-base font-semibold text-white hover:bg-brand-green/90"
      >
        {saving ? "发布中…" : publishLabel}
      </Button>
    </div>
  );
}
