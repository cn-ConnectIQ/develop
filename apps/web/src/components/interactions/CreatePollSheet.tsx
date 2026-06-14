"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CheckCircle,
  CheckSquare,
  Cloud,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { PollListItem, SessionOption } from "@/lib/interactions";
import { cn } from "@/lib/utils";

const POLL_TYPES = [
  { value: "SINGLE_CHOICE", label: "单选", icon: CheckCircle },
  { value: "MULTI_CHOICE", label: "多选", icon: CheckSquare },
  { value: "WORD_CLOUD", label: "词云", icon: Cloud },
  { value: "RATING", label: "评分", icon: Star },
] as const;

const schema = z.object({
  title: z.string().min(1, "请输入投票题目").max(200),
  type: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE", "WORD_CLOUD", "RATING"]),
  options: z.array(z.object({ text: z.string().min(1) })).min(1),
  publishMode: z.enum(["manual", "delay", "session"]),
  publishDelayMinutes: z.number().min(1).max(1440).optional(),
  triggerSessionId: z.string().optional(),
  timeLimitEnabled: z.boolean(),
  timeLimitMinutes: z.number().min(1).max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

type CreatePollSheetProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  sessions?: SessionOption[];
  editPoll?: PollListItem | null;
};

export function CreatePollSheet({
  eventId,
  open,
  onOpenChange,
  onSuccess,
  sessions = [],
  editPoll,
}: CreatePollSheetProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      type: "SINGLE_CHOICE",
      options: [{ text: "选项 1" }, { text: "选项 2" }],
      publishMode: "manual",
      publishDelayMinutes: 5,
      triggerSessionId: "",
      timeLimitEnabled: false,
      timeLimitMinutes: 10,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });

  useEffect(() => {
    if (!open) return;
    if (editPoll) {
      form.reset({
        title: editPoll.title,
        type: editPoll.type as FormValues["type"],
        options:
          editPoll.options.length > 0
            ? editPoll.options.map((o) => ({ text: o.text }))
            : [{ text: "选项 1" }, { text: "选项 2" }],
        publishMode: "manual",
        publishDelayMinutes: 5,
        timeLimitEnabled: Boolean(editPoll.closesAt),
        timeLimitMinutes: 10,
      });
    } else {
      form.reset({
        title: "",
        type: "SINGLE_CHOICE",
        options: [{ text: "选项 1" }, { text: "选项 2" }],
        publishMode: "manual",
        publishDelayMinutes: 5,
        triggerSessionId: "",
        timeLimitEnabled: false,
        timeLimitMinutes: 10,
      });
    }
  }, [open, editPoll, form]);

  const selectedType = form.watch("type");
  const timeLimitEnabled = form.watch("timeLimitEnabled");
  const publishMode = form.watch("publishMode");
  const showOptions =
    selectedType === "SINGLE_CHOICE" || selectedType === "MULTI_CHOICE";

  async function submit(values: FormValues, immediate: boolean) {
    setSubmitting(true);
    try {
      const optionTexts = showOptions
        ? values.options.map((o) => o.text)
        : selectedType === "RATING"
          ? ["5分", "4分", "3分", "2分", "1分"]
          : ["开放回答"];

      const payload: Record<string, unknown> = {
        title: values.title,
        type: values.type,
        options: optionTexts,
        status: immediate ? "LIVE" : "DRAFT",
        timeLimitMinutes:
          immediate && values.timeLimitEnabled
            ? values.timeLimitMinutes
            : undefined,
      };

      if (!immediate && values.publishMode === "delay") {
        payload.publishAfterMinutes = values.publishDelayMinutes ?? 5;
      }

      if (editPoll) {
        const res = await fetch(
          `/api/events/${eventId}/polls/${editPoll.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: values.title,
              options: optionTexts.map((text) => ({ text })),
              ...(immediate
                ? {
                    status: "LIVE",
                    timeLimitMinutes: values.timeLimitEnabled
                      ? values.timeLimitMinutes
                      : undefined,
                  }
                : {}),
            }),
          },
        );
        if (!res.ok) {
          toast.error("保存失败");
          return;
        }
        toast.success(immediate ? "投票已发布" : "已保存");
      } else {
        const res = await fetch(`/api/events/${eventId}/polls`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error ?? "创建失败");
          return;
        }
        toast.success(immediate ? "投票已发布" : "草稿已保存");
      }

      onOpenChange(false);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>{editPoll ? "编辑投票" : "创建投票"}</SheetTitle>
        </SheetHeader>

        <form className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label>投票题目</Label>
            <Textarea
              rows={3}
              className="min-h-[80px] resize-y"
              maxLength={200}
              {...form.register("title")}
            />
            <p className="text-right text-xs text-text-muted">
              {form.watch("title").length}/200
            </p>
          </div>

          {!editPoll && (
            <div className="space-y-2">
              <Label>投票类型</Label>
              <div className="grid grid-cols-2 gap-2">
                {POLL_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => form.setValue("type", value)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors",
                      selectedType === value
                        ? "border-brand-blue bg-brand-blue-light text-brand-blue"
                        : "border-border-light hover:border-brand-blue/50",
                    )}
                  >
                    <Icon className="size-6" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showOptions && (
            <div className="space-y-2">
              <Label>选项</Label>
              {fields.map((field, index) => (
                <div key={field.id} className="group flex gap-2">
                  <Input {...form.register(`options.${index}.text`)} />
                  {fields.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-4 text-text-tertiary" />
                    </Button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => append({ text: `选项 ${fields.length + 1}` })}
                className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-light py-2.5 text-sm text-text-muted hover:border-brand-blue/50 hover:text-brand-blue"
              >
                <Plus className="size-4" />
                添加选项
              </button>
            </div>
          )}

          {!editPoll && (
            <div className="space-y-3 rounded-lg border border-border-light p-4">
              <Label className="text-xs font-semibold">发布时机</Label>
              <div className="space-y-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={publishMode === "manual"}
                    onChange={() => form.setValue("publishMode", "manual")}
                    className="accent-brand-blue"
                  />
                  手动发布
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={publishMode === "delay"}
                    onChange={() => form.setValue("publishMode", "delay")}
                    className="accent-brand-blue"
                  />
                  <span className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={1440}
                      className="h-8 w-16"
                      disabled={publishMode !== "delay"}
                      {...form.register("publishDelayMinutes", {
                        valueAsNumber: true,
                      })}
                    />
                    分钟后自动发布
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="radio"
                    checked={publishMode === "session"}
                    onChange={() => form.setValue("publishMode", "session")}
                    className="accent-brand-blue"
                  />
                  某议题结束后
                </label>
                {publishMode === "session" && (
                  <Select
                    value={form.watch("triggerSessionId") || undefined}
                    onValueChange={(v) =>
                      form.setValue("triggerSessionId", v ?? "")
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="选择议题" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.length === 0 && (
                        <SelectItem value="__none" disabled>
                          暂无议题
                        </SelectItem>
                      )}
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2 rounded-lg border border-border-light p-4">
            <div className="flex items-center justify-between">
              <Label>限时</Label>
              <Switch
                checked={timeLimitEnabled}
                onCheckedChange={(v) => form.setValue("timeLimitEnabled", v)}
              />
            </div>
            {timeLimitEnabled && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={120}
                  className="h-9 w-24"
                  {...form.register("timeLimitMinutes", { valueAsNumber: true })}
                />
                <span className="text-sm text-text-muted">分钟</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={submitting}
              onClick={() => void form.handleSubmit((v) => submit(v, false))()}
            >
              保存草稿
            </Button>
            <Button
              type="button"
              className="flex-1 bg-brand-blue hover:bg-brand-blue/90"
              disabled={submitting}
              onClick={() => void form.handleSubmit((v) => submit(v, true))()}
            >
              立即发布
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
