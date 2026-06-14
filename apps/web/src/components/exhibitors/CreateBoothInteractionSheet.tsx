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
  Gift,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { InteractionQRDisplay } from "@/components/interactions/InteractionQRDisplay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const POLL_TYPES = [
  { value: "SINGLE_CHOICE", label: "单选", icon: CheckCircle },
  { value: "MULTI_CHOICE", label: "多选", icon: CheckSquare },
  { value: "WORD_CLOUD", label: "词云", icon: Cloud },
  { value: "RATING", label: "评分", icon: Star },
] as const;

const schema = z.object({
  kind: z.enum(["poll", "lottery"]),
  title: z.string().min(1, "请输入标题").max(200),
  type: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE", "WORD_CLOUD", "RATING"]),
  options: z.array(z.object({ text: z.string().min(1) })).min(1),
  timeLimitEnabled: z.boolean(),
  timeLimitMinutes: z.number().min(1).max(120).optional(),
});

type FormValues = z.infer<typeof schema>;

type CreatedSession = {
  id: string;
  sessionCode: string;
  qrUrl: string | null;
  scanUrl: string;
  name: string;
};

type CreateBoothInteractionSheetProps = {
  boothId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function CreateBoothInteractionSheet({
  boothId,
  open,
  onOpenChange,
  onSuccess,
}: CreateBoothInteractionSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const [createdSession, setCreatedSession] = useState<CreatedSession | null>(
    null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: "poll",
      title: "",
      type: "SINGLE_CHOICE",
      options: [{ text: "选项 1" }, { text: "选项 2" }],
      timeLimitEnabled: false,
      timeLimitMinutes: 10,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "options",
  });

  useEffect(() => {
    if (!open) {
      setCreatedSession(null);
      return;
    }
    form.reset({
      kind: "poll",
      title: "",
      type: "SINGLE_CHOICE",
      options: [{ text: "选项 1" }, { text: "选项 2" }],
      timeLimitEnabled: false,
      timeLimitMinutes: 10,
    });
  }, [open, form]);

  const selectedKind = form.watch("kind");
  const selectedType = form.watch("type");
  const timeLimitEnabled = form.watch("timeLimitEnabled");
  const showOptions =
    selectedKind === "poll" &&
    (selectedType === "SINGLE_CHOICE" || selectedType === "MULTI_CHOICE");

  async function submit(values: FormValues) {
    setSubmitting(true);
    try {
      const payload =
        values.kind === "lottery"
          ? {
              kind: "lottery" as const,
              title: values.title,
              publish_immediately: true,
            }
          : {
              kind: "poll" as const,
              title: values.title,
              type: values.type,
              options: showOptions
                ? values.options.map((o) => o.text)
                : undefined,
              publish_immediately: true,
              time_limit_minutes:
                values.timeLimitEnabled && values.timeLimitMinutes
                  ? values.timeLimitMinutes
                  : undefined,
            };

      const res = await fetch(
        `/api/exhibitor/booths/${boothId}/interactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "创建失败");
        return;
      }

      toast.success("互动已创建");
      setCreatedSession(json.data.session as CreatedSession);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>发起展位互动</SheetTitle>
        </SheetHeader>

        <div className="mt-4 rounded-xl bg-brand-amber-light px-4 py-3 text-sm text-brand-amber">
          此互动仅限来访本展位的参会者参与
        </div>

        {createdSession ? (
          <div className="mt-6">
            <p className="text-sm text-text-muted">
              「{createdSession.name}」已创建，请展示二维码供参会者扫码参与。
            </p>
            <InteractionQRDisplay
              sessionCode={createdSession.sessionCode}
              qrUrl={createdSession.qrUrl ?? ""}
              interactionTitle={createdSession.name}
              className="mt-6 border-0 p-0 shadow-none"
            />
            <Button
              type="button"
              variant="outline"
              className="mt-4 w-full rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              完成
            </Button>
          </div>
        ) : (
          <form className="mt-6 space-y-5">
            <div className="space-y-2">
              <Label>互动类型</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => form.setValue("kind", "poll")}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                    selectedKind === "poll"
                      ? "border-brand-amber bg-brand-amber-light text-brand-amber"
                      : "border-border-light hover:border-brand-amber/50",
                  )}
                >
                  投票互动
                </button>
                <button
                  type="button"
                  onClick={() => form.setValue("kind", "lottery")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors",
                    selectedKind === "lottery"
                      ? "border-brand-amber bg-brand-amber-light text-brand-amber"
                      : "border-border-light hover:border-brand-amber/50",
                  )}
                >
                  <Gift className="size-4" />
                  现场抽奖
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{selectedKind === "lottery" ? "抽奖名称" : "投票题目"}</Label>
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

            {selectedKind === "poll" && (
              <div className="space-y-2">
                <Label>题型</Label>
                <div className="grid grid-cols-2 gap-2">
                  {POLL_TYPES.map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => form.setValue("type", value)}
                      className={cn(
                        "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm transition-colors",
                        selectedType === value
                          ? "border-brand-amber bg-brand-amber-light text-brand-amber"
                          : "border-border-light hover:border-brand-amber/50",
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
                  className="flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-light py-2.5 text-sm text-text-muted hover:border-brand-amber/50 hover:text-brand-amber"
                >
                  <Plus className="size-4" />
                  添加选项
                </button>
              </div>
            )}

            {selectedKind === "poll" && (
              <div className="space-y-2 rounded-lg border border-border-light p-4">
                <div className="flex items-center justify-between">
                  <Label>限时</Label>
                  <Switch
                    checked={timeLimitEnabled}
                    onCheckedChange={(v) =>
                      form.setValue("timeLimitEnabled", v)
                    }
                  />
                </div>
                {timeLimitEnabled && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      className="h-9 w-24"
                      {...form.register("timeLimitMinutes", {
                        valueAsNumber: true,
                      })}
                    />
                    <span className="text-sm text-text-muted">分钟</span>
                  </div>
                )}
              </div>
            )}

            <Button
              type="button"
              className="h-10 w-full rounded-xl bg-brand-amber text-white hover:bg-brand-amber/90"
              disabled={submitting}
              onClick={() => void form.handleSubmit((v) => submit(v))()}
            >
              {submitting ? "创建中..." : "立即发布并生成二维码"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
