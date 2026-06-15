"use client";

import { Textarea } from "@/components/ui/textarea";

type WordCloudEditorProps = {
  value?: string;
  onChange?: (value: string) => void;
};

export function WordCloudEditor({ value = "", onChange }: WordCloudEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder="补充说明或问题背景（选填）"
      className="mt-4 w-full rounded-xl border border-border-light bg-white p-3 text-sm"
      rows={4}
    />
  );
}
