"use client";

import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  BarChart3,
  Gift,
  MessageSquare,
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

type InteractionMode = "poll" | "qna" | "lottery";

const schema = z.object({
  title: z.string().min(1, "请输入标题").max(200),
  pollType: z.enum(["SINGLE_CHOICE", "MULTI_CHOICE", "RATING"]),
  options: z.array(z.object({ text: z.string().min(1) })).min(1),
  qnaPrompt: z.string().max(200).optional(),
  qnaModeration: z.boolean(),
  prizeName: z.string().optional(),
  winnerCount: z.number().min(1).max(20).optional(),
  requireLeadCapture: z.boolean(),
  publishImmediately: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

type CreatedSession = {
  id: string;
  sessionCode: string;
  qrUrl: string | null;
  scanUrl: string;
  name: string;
};

type BoothInteractionSheetProps = {
  boothId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

const MODE_CARDS: Array<{
  mode: InteractionMode;
  label: string;
  desc: string;
  icon: typeof BarChart3;
  iconClass: string;
}> = [
  {
    mode: "poll",
    label: "投票 / 问卷",
    desc: "单选、多选、评分",
    icon: BarChart3,
    iconClass: "text-brand-amber",
  },
  {
    mode: "qna",
    label: "问答征集",
    desc: "收集参会者提问",
    icon: MessageSquare,
    iconClass: "text-brand-amber",
  },
  {
    mode: "lottery",
    label: "展位抽奖",
    desc: "聚人气、留资抽奖",
    icon: Gift,
    iconClass: "text-brand-gold",
  },
];

export function BoothInteractionSheet({
  boothId,
  open,
  onOpenChange,
  onSuccess,
}: BoothInteractionSheetProps) {
  const [mode, setMode] = useState<InteractionMode>("poll");
  const [submitting, setSubmitting] = useState(false);
  const [createdSession, setCreatedSession] = useState<CreatedSession | null>(
    null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      pollType: "SINGLE_CHOICE",
      options: [{ text: "选项 1" }, { text: "选项 2" }],
      qnaPrompt: "欢迎向展位提问",
      qnaModeration: false,
      prizeName: "精美礼品",
      winnerCount: 1,
      requireLeadCapture: false,
      publishImmediately: false,
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
    form.reset();
    setMode("poll");
  }, [open, form]);

  const pollType = form.watch("pollType");
  const showOptions =
    mode === "poll" &&
    (pollType === "SINGLE_CHOICE" || pollType === "MULTI_CHOICE");

  async function submitDraft() {
    await submit(false);
  }

  async function submitAndPublish() {
    await submit(true);
  }

  async function submit(publishImmediately: boolean) {
    const values = form.getValues();
    if (!values.title.trim()) {
      toast.error("请输入标题");
      return;
    }

    setSubmitting(true);
    try {
      let payload: Record<string, unknown>;

      if (mode === "qna") {
        payload = {
          kind: "poll",
          title: values.title,
          type: "QNA",
          publish_immediately: publishImmediately,
          qna_moderation: values.qnaModeration,
        };
      } else if (mode === "lottery") {
        payload = {
          kind: "lottery",
          title: values.title,
          publish_immediately: publishImmediately,
          require_lead_capture: values.requireLeadCapture,
          prizes: [
            {
              rank: 1,
              name: "一等奖",
              prize: values.prizeName || "奖品",
              count: values.winnerCount ?? 1,
            },
          ],
          winner_count: values.winnerCount ?? 1,
        };
      } else {
        payload = {
          kind: "poll",
          title: values.title,
          type: values.pollType,
          options: showOptions
            ? values.options.map((o) => o.text)
            : undefined,
          publish_immediately: publishImmediately,
        };
      }

      const res = await fetch(`/api/booths/${boothId}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error?.message ?? json.error ?? "创建失败");
        return;
      }

      toast.success(publishImmediately ? "已发起并生成互动码" : "草稿已保存");
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
          <div className="mt-6 space-y-5">
            <div className="grid grid-cols-3 gap-2">
              {MODE_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.mode}
                    type="button"
                    onClick={() => setMode(card.mode)}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-colors",
                      mode === card.mode
                        ? "border-brand-amber bg-brand-amber-light"
                        : "border-border-light hover:border-brand-amber/40",
                    )}
                  >
                    <Icon className={cn("size-6", card.iconClass)} />
                    <span className="text-xs font-medium">{card.label}</span>
                    <span className="text-[10px] text-text-muted">
                      {card.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="space-y-2">
              <Label>
                {mode === "lottery" ? "抽奖名称" : mode === "qna" ? "问答主题" : "投票题目"}
              </Label>
              <Textarea rows={2} maxLength={200} {...form.register("title")} />
            </div>

            {mode === "poll" && (
              <>
                <div className="space-y-2">
                  <Label>题型</Label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["SINGLE_CHOICE", "单选"],
                        ["MULTI_CHOICE", "多选"],
                        ["RATING", "评分"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => form.setValue("pollType", value)}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm",
                          pollType === value
                            ? "border-brand-amber bg-brand-amber-light text-brand-amber"
                            : "border-border-light",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {showOptions && (
                  <div className="space-y-2">
                    <Label>选项</Label>
                    {fields.map((field, index) => (
                      <div key={field.id} className="flex gap-2">
                        <Input {...form.register(`options.${index}.text`)} />
                        {fields.length > 2 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(index)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => append({ text: `选项 ${fields.length + 1}` })}
                      className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed py-2 text-sm text-text-muted"
                    >
                      <Plus className="size-4" />
                      添加选项
                    </button>
                  </div>
                )}
              </>
            )}

            {mode === "qna" && (
              <div className="space-y-3 rounded-lg border border-border-light p-4">
                <div className="space-y-2">
                  <Label>提示语</Label>
                  <Input {...form.register("qnaPrompt")} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>审核后展示</Label>
                  <Switch
                    checked={form.watch("qnaModeration")}
                    onCheckedChange={(v) => form.setValue("qnaModeration", v)}
                  />
                </div>
              </div>
            )}

            {mode === "lottery" && (
              <div className="space-y-3 rounded-lg border border-brand-gold/30 bg-[#FFFDF0] p-4">
                <div className="space-y-2">
                  <Label>奖品名称</Label>
                  <Input {...form.register("prizeName")} />
                </div>
                <div className="space-y-2">
                  <Label>中奖名额</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    className="w-24"
                    {...form.register("winnerCount", { valueAsNumber: true })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>参与即采集线索</Label>
                    <p className="text-xs text-text-muted">
                      参会者参与抽奖时留资，转化为展位线索
                    </p>
                  </div>
                  <Switch
                    checked={form.watch("requireLeadCapture")}
                    onCheckedChange={(v) =>
                      form.setValue("requireLeadCapture", v)
                    }
                  />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl"
                disabled={submitting}
                onClick={() => void submitDraft()}
              >
                保存草稿
              </Button>
              <Button
                type="button"
                className="flex-1 rounded-xl bg-brand-amber text-white hover:bg-brand-amber/90"
                disabled={submitting}
                onClick={() => void submitAndPublish()}
              >
                {submitting ? "创建中…" : "发起并生成互动码"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
