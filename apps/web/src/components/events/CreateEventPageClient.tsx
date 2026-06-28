"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  Building2,
  Coffee,
  FileSpreadsheet,
  GraduationCap,
  PenLine,
  RefreshCw,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { PageHead } from "@/components/admin/page-head";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  eventCategoryOptions,
  type EventCategory,
} from "@/lib/event-utils";
import { useEventsMutationRefetch } from "@/hooks/useEvents";
import { cn } from "@/lib/utils";

type EventSource = "manual" | "excel" | "baige";

const categoryIcons: Record<
  EventCategory,
  ComponentType<{ className?: string }>
> = {
  SUMMIT: Building2,
  EXPO: Store,
  SALON: Coffee,
  TRAINING: GraduationCap,
};

const step1Schema = z.object({
  name: z.string().min(2, "活动名称至少 2 个字符"),
  category: z.enum(["SUMMIT", "EXPO", "SALON", "TRAINING"]),
  startDate: z.string().min(1, "请选择开始时间"),
  endDate: z.string().min(1, "请选择结束时间"),
  city: z.string().optional(),
  venue: z.string().optional(),
});

const step2Schema = z.object({
  description: z.string().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

const SOURCE_OPTIONS: Array<{
  id: EventSource;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  requiresBaige?: boolean;
}> = [
  {
    id: "manual",
    title: "独立创建",
    description: "手动填写活动信息，适合任意平台办会的主办方",
    icon: PenLine,
  },
  {
    id: "excel",
    title: "Excel 导入名单",
    description: "创建活动后导入参会名单（Cvent、活动行等导出均可）",
    icon: FileSpreadsheet,
  },
  {
    id: "baige",
    title: "从百格同步",
    description: "已是百格客户？创建后可一键同步报名数据",
    icon: RefreshCw,
    requiresBaige: true,
  },
];

function buildPayload(step1: Step1Values, description: string) {
  const locationParts = [step1.city?.trim(), step1.venue?.trim()].filter(Boolean);
  return {
    name: step1.name,
    category: step1.category,
    startDate: new Date(step1.startDate).toISOString(),
    endDate: new Date(step1.endDate).toISOString(),
    city: step1.city,
    venue: step1.venue,
    location: locationParts.length > 0 ? locationParts.join(" · ") : undefined,
    description,
  };
}

function validateForReview(step1: Step1Values, description: string) {
  if (!step1.name?.trim()) return "活动名称不能为空";
  if (!step1.startDate) return "开始时间不能为空";
  if (!step1.endDate) return "结束时间不能为空";
  const locationParts = [step1.city?.trim(), step1.venue?.trim()].filter(Boolean);
  if (locationParts.length === 0) return "地点不能为空";
  if (!description?.trim()) return "活动描述不能为空";
  return null;
}

async function fetchBaigeStatus() {
  const res = await fetch("/api/integrations/baige/status");
  if (!res.ok) return { connected: false, source: null };
  return (await res.json()).data as {
    connected: boolean;
    source: "env" | "platform" | null;
  };
}

export function CreateEventPageClient() {
  const router = useRouter();
  const refetch = useEventsMutationRefetch();
  const [source, setSource] = useState<EventSource>("manual");
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);
  const [successOpen, setSuccessOpen] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  const { data: baigeStatus } = useQuery({
    queryKey: ["baige-connection-status"],
    queryFn: fetchBaigeStatus,
  });

  const baigeConnected = baigeStatus?.connected ?? false;
  const visibleSources = SOURCE_OPTIONS.filter(
    (option) => !option.requiresBaige || baigeConnected,
  );

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      name: "",
      category: "SUMMIT",
      startDate: "",
      endDate: "",
      city: "",
      venue: "",
    },
  });

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { description: "" },
  });

  const selectedCategory = step1Form.watch("category");

  useEffect(() => {
    if (source === "baige" && !baigeConnected) {
      setSource("manual");
    }
  }, [source, baigeConnected]);

  function onStep1Next(values: Step1Values) {
    if (new Date(values.endDate) <= new Date(values.startDate)) {
      step1Form.setError("endDate", { message: "结束时间须晚于开始时间" });
      return;
    }
    setStep1Data(values);
    setStep(2);
  }

  function onStep2Next(values: Step2Values) {
    step2Form.reset(values);
    setStep(3);
  }

  async function saveEventDraft(): Promise<string | null> {
    if (!step1Data) return null;
    const description = step2Form.getValues("description") ?? "";
    const payload = buildPayload(step1Data, description);

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error ?? "创建失败");
      return null;
    }
    return json.data.id as string;
  }

  function postCreatePath(eventId: string) {
    if (source === "excel") {
      return `/events/${eventId}/data-import?tab=excel`;
    }
    if (source === "baige") {
      return `/events/${eventId}/data-import?tab=baige`;
    }
    return `/events/${eventId}`;
  }

  async function onSaveDraft() {
    setSubmitting(true);
    try {
      const eventId = await saveEventDraft();
      if (!eventId) return;
      toast.success("草稿已保存");
      await refetch();
      router.push(postCreatePath(eventId));
    } finally {
      setSubmitting(false);
    }
  }

  async function onPublish() {
    if (!step1Data) return;

    const description = step2Form.getValues("description") ?? "";
    const validationError = validateForReview(step1Data, description);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const eventId = await saveEventDraft();
      if (!eventId) return;

      const res = await fetch(`/api/events/${eventId}/publish`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "发布失败");
        return;
      }

      setCreatedEventId(eventId);
      setSuccessOpen(true);
      await refetch();
    } finally {
      setSubmitting(false);
    }
  }

  function handleSuccessClose() {
    setSuccessOpen(false);
    if (createdEventId) {
      router.push(postCreatePath(createdEventId));
    }
  }

  const categoryLabel =
    eventCategoryOptions.find((o) => o.value === step1Data?.category)?.label ??
    "";

  const sourceHint =
    source === "excel"
      ? "创建完成后将引导您导入 Excel 参会名单，无需绑定任何第三方平台。"
      : source === "baige"
        ? "创建完成后可同步百格侧已有报名，百格仅为可选数据来源。"
        : "填写基本信息即可开始使用 ConnectIQ 的全部现场功能。";

  return (
    <AdminPageBody>
      <PageHead
        title="创建活动"
        description="选择数据来源方式，ConnectIQ 支持独立办会与多平台名单导入"
        actions={
          <Link
            href="/events"
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <ArrowLeft className="mr-1 size-4" />
            返回活动列表
          </Link>
        }
      />

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold text-[var(--admin-ink)]">
          活动来源
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          三种方式完全独立，可按您的办会习惯任选其一
        </p>
        <div
          className={cn(
            "grid gap-3",
            visibleSources.length === 3 ? "md:grid-cols-3" : "md:grid-cols-2",
          )}
        >
          {visibleSources.map((option) => {
            const Icon = option.icon;
            const selected = source === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSource(option.id)}
                className={cn(
                  "flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-colors",
                  selected
                    ? "border-brand-blue bg-brand-blue-light ring-1 ring-brand-blue/30"
                    : "border-border-light bg-white hover:border-brand-blue/40",
                  option.id === "manual" && selected && "shadow-sm",
                )}
              >
                <Icon
                  className={cn(
                    "size-5",
                    selected ? "text-brand-blue" : "text-text-muted",
                  )}
                />
                <div>
                  <p className="font-medium text-[var(--admin-ink)]">
                    {option.title}
                    {option.id === "manual" && (
                      <span className="ml-2 rounded bg-brand-blue/10 px-1.5 py-0.5 text-[10px] font-normal text-brand-blue">
                        推荐
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-text-muted">
                    {option.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-muted">{sourceHint}</p>
      </section>

      <section className="admin-card admin-card-pad-lg max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--admin-ink)]">
            活动信息
          </h2>
          <span className="text-xs text-text-muted">步骤 {step}/3</span>
        </div>

        {step === 1 && (
          <form
            onSubmit={step1Form.handleSubmit(onStep1Next)}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="name">活动名称 *</Label>
              <Input
                id="name"
                placeholder="例如：2026 行业创新峰会"
                {...step1Form.register("name")}
              />
              {step1Form.formState.errors.name && (
                <p className="text-xs text-brand-red">
                  {step1Form.formState.errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>活动类型 *</Label>
              <div className="grid grid-cols-2 gap-2">
                {eventCategoryOptions.map((option) => {
                  const Icon = categoryIcons[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        step1Form.setValue("category", option.value)
                      }
                      className={cn(
                        "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                        selectedCategory === option.value
                          ? "border-brand-blue bg-brand-blue-light"
                          : "border-border-light hover:border-brand-blue/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-5",
                          selectedCategory === option.value
                            ? "text-brand-blue"
                            : "text-text-muted",
                        )}
                      />
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-text-muted">
                        {option.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="startDate">开始时间 *</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  {...step1Form.register("startDate")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">结束时间 *</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  {...step1Form.register("endDate")}
                />
                {step1Form.formState.errors.endDate && (
                  <p className="text-xs text-brand-red">
                    {step1Form.formState.errors.endDate.message}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">城市 *</Label>
                <Input id="city" placeholder="上海" {...step1Form.register("city")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue">具体地址</Label>
                <Input
                  id="venue"
                  placeholder="国家会展中心"
                  {...step1Form.register("venue")}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-brand-blue text-white hover:bg-brand-blue/90"
            >
              下一步 →
            </Button>
          </form>
        )}

        {step === 2 && (
          <form
            onSubmit={step2Form.handleSubmit(onStep2Next)}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label htmlFor="description">活动简介 *</Label>
              <Textarea
                id="description"
                rows={5}
                placeholder="简要介绍活动亮点、目标受众..."
                {...step2Form.register("description")}
              />
              <p className="text-xs text-text-muted">发布活动时必填</p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(1)}
              >
                上一步
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-brand-blue text-white hover:bg-brand-blue/90"
              >
                下一步 →
              </Button>
            </div>
          </form>
        )}

        {step === 3 && step1Data && (
          <div className="space-y-5">
            <div className="space-y-3 rounded-xl border border-border-light bg-content p-4 text-sm">
              <Row label="活动名称" value={step1Data.name} />
              <Row label="活动类型" value={categoryLabel} />
              <Row label="开始时间" value={step1Data.startDate.replace("T", " ")} />
              <Row label="结束时间" value={step1Data.endDate.replace("T", " ")} />
              <Row
                label="地点"
                value={
                  [step1Data.city, step1Data.venue].filter(Boolean).join(" · ") ||
                  "—"
                }
              />
              <Row
                label="简介"
                value={step2Form.getValues("description") || "—"}
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep(2)}
              >
                上一步
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onClick={() => void onSaveDraft()}
              >
                保存草稿
              </Button>
              <Button
                type="button"
                className="flex-1 bg-brand-blue text-white hover:bg-brand-blue/90"
                disabled={submitting}
                onClick={() => void onPublish()}
              >
                {submitting ? "提交中…" : "发布活动"}
              </Button>
            </div>
          </div>
        )}
      </section>

      <Dialog open={successOpen} onOpenChange={setSuccessOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>活动已发布</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-text-muted">
            {source === "excel"
              ? "接下来可导入 Excel 参会名单。"
              : source === "baige"
                ? "接下来可同步百格报名数据（可选）。"
                : "您可以在活动工作台继续配置功能模块。"}
          </p>
          <DialogFooter>
            <Button onClick={handleSuccessClose}>继续</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPageBody>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <span className="w-20 shrink-0 text-text-muted">{label}</span>
      <span className="text-[var(--admin-ink)]">{value}</span>
    </div>
  );
}
