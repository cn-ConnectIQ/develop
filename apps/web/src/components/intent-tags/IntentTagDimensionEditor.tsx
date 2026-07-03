"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type IntentTagDimensionEditorProps = {
  title: string;
  description: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  chipClassName?: string;
};

export function IntentTagDimensionEditor({
  title,
  description,
  tags,
  onChange,
  placeholder = "输入标签后回车添加",
  chipClassName,
}: IntentTagDimensionEditorProps) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const label = raw.trim();
    if (!label) return;
    if (tags.some((t) => t.toLowerCase() === label.toLowerCase())) {
      setDraft("");
      return;
    }
    onChange([...tags, label]);
    setDraft("");
  }

  function removeTag(label: string) {
    onChange(tags.filter((t) => t !== label));
  }

  return (
    <section className="rounded-xl border border-border-light bg-white p-5">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--admin-ink)]">{title}</h3>
        <p className="mt-1 text-xs text-text-muted">{description}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
              chipClassName ??
                "border-border-light bg-gray-50 text-text-muted",
            )}
          >
            {tag}
            <button
              type="button"
              className="text-text-muted hover:text-brand-red"
              onClick={() => removeTag(tag)}
              aria-label={`删除 ${tag}`}
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <Input
          value={draft}
          placeholder={placeholder}
          className="h-9"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(draft);
            }
          }}
        />
        <button
          type="button"
          className="shrink-0 rounded-lg border border-dashed border-brand-blue px-3 text-xs text-brand-blue hover:bg-brand-blue-light"
          onClick={() => addTag(draft)}
        >
          + 添加标签
        </button>
      </div>
    </section>
  );
}
