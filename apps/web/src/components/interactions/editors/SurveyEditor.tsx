"use client";

import { useState } from "react";
import { GripVertical, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PollOptionsEditor } from "@/components/interactions/editors/PollOptionsEditor";
import { WordCloudEditor } from "@/components/interactions/editors/WordCloudEditor";
import { RatingEditor } from "@/components/interactions/editors/RatingEditor";

type SurveyQuestion = {
  id: string;
  title: string;
  type: "SINGLE_CHOICE" | "MULTI_CHOICE" | "WORD_CLOUD" | "RATING";
  options: Array<{ id: string; text: string }>;
};

type SurveyEditorProps = {
  eventId: string;
  pollId: string;
};

export function SurveyEditor({ eventId, pollId }: SurveyEditorProps) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    {
      id: "q1",
      title: "第一题",
      type: "SINGLE_CHOICE",
      options: [
        { id: "o1", text: "选项 1" },
        { id: "o2", text: "选项 2" },
      ],
    },
  ]);

  function addQuestion() {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q-${Date.now()}`,
        title: `第 ${prev.length + 1} 题`,
        type: "SINGLE_CHOICE",
        options: [
          { id: `o-${Date.now()}-1`, text: "选项 1" },
          { id: `o-${Date.now()}-2`, text: "选项 2" },
        ],
      },
    ]);
  }

  return (
    <div className="mt-4 space-y-3">
      {questions.map((q, index) => (
        <div
          key={q.id}
          className="group rounded-xl border border-border-light bg-white p-4 hover:border-brand-blue/30"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-text-muted">第 {index + 1} 题</span>
            <div className="flex items-center gap-2">
              <Select
                value={q.type}
                onValueChange={(v) =>
                  setQuestions((prev) =>
                    prev.map((item) =>
                      item.id === q.id
                        ? { ...item, type: v as SurveyQuestion["type"] }
                        : item,
                    ),
                  )
                }
              >
                <SelectTrigger className="h-7 w-24 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SINGLE_CHOICE">单选</SelectItem>
                  <SelectItem value="MULTI_CHOICE">多选</SelectItem>
                  <SelectItem value="WORD_CLOUD">词云</SelectItem>
                  <SelectItem value="RATING">评分</SelectItem>
                </SelectContent>
              </Select>
              <GripVertical className="size-4 cursor-grab text-text-muted/40" />
            </div>
          </div>
          <div
            contentEditable
            suppressContentEditableWarning
            className="min-h-[32px] text-base font-medium outline-none"
          >
            {q.title}
          </div>
          {q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE" ? (
            <PollOptionsEditor
              eventId={eventId}
              pollId={pollId}
              type={q.type}
              options={q.options}
            />
          ) : q.type === "WORD_CLOUD" ? (
            <WordCloudEditor />
          ) : (
            <RatingEditor />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={addQuestion}
        className="flex h-10 w-full items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border-light text-sm text-brand-blue hover:border-brand-blue"
      >
        <Plus className="size-4" />
        添加题目
      </button>
    </div>
  );
}
