"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Building2,
  Coffee,
  GraduationCap,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  eventCategoryOptions,
  type EventCategory,
} from "@/lib/event-utils";
import { useEventsMutationRefetch } from "@/hooks/useEvents";
import { cn } from "@/lib/utils";

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

type CreateEventSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateEventSheet({ open, onOpenChange }: CreateEventSheetProps) {
  const router = useRouter();
  const refetch = useEventsMutationRefetch();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [step1Data, setStep1Data] = useState<Step1Values | null>(null);

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

  function resetAll() {
    setStep(1);
    setStep1Data(null);
    step1Form.reset();
    step2Form.reset();
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetAll();
    onOpenChange(next);
  }

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

  async function onCreate() {
    if (!step1Data) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: step1Data.name,
          category: step1Data.category,
          startDate: new Date(step1Data.startDate).toISOString(),
          endDate: new Date(step1Data.endDate).toISOString(),
          city: step1Data.city,
          venue: step1Data.venue,
          description: step2Form.getValues("description"),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "创建失败");
        return;
      }
      toast.success("活动创建成功");
      handleOpenChange(false);
      await refetch();
      router.push(`/events/${json.data.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  const categoryLabel =
    eventCategoryOptions.find((o) => o.value === step1Data?.category)?.label ??
    "";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>创建活动</SheetTitle>
          <p className="text-sm text-text-muted">步骤 {step}/3</p>
        </SheetHeader>

        {step === 1 && (
          <form
            onSubmit={step1Form.handleSubmit(onStep1Next)}
            className="mt-6 flex flex-1 flex-col space-y-5"
          >
            <p className="text-sm font-medium text-[var(--admin-ink)]">
              基本信息
            </p>

            <div className="space-y-2">
              <Label htmlFor="name">活动名称 *</Label>
              <Input id="name" placeholder="例如：ConnectIQ 2026 行业峰会" {...step1Form.register("name")} />
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
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          selectedCategory === option.value
                            ? "text-brand-blue"
                            : "text-[var(--admin-ink)]",
                        )}
                      >
                        {option.label}
                      </span>
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
                <Label htmlFor="city">城市</Label>
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

            <div className="flex-1" />
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
            className="mt-6 flex flex-1 flex-col space-y-5"
          >
            <p className="text-sm font-medium text-[var(--admin-ink)]">
              活动详情
            </p>
            <div className="space-y-2">
              <Label htmlFor="description">活动简介</Label>
              <Textarea
                id="description"
                rows={5}
                placeholder="简要介绍活动亮点、目标受众..."
                {...step2Form.register("description")}
              />
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
          <div className="mt-6 flex flex-1 flex-col space-y-5">
            <p className="text-sm font-medium text-[var(--admin-ink)]">
              确认信息
            </p>
            <div className="space-y-3 rounded-xl border border-border-light bg-content p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">活动名称</span>
                <span className="font-medium text-[var(--admin-ink)]">
                  {step1Data.name}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">活动类型</span>
                <span className="font-medium">{categoryLabel}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-text-muted">时间</span>
                <span className="text-right font-medium">
                  {step1Data.startDate.replace("T", " ")} —{" "}
                  {step1Data.endDate.replace("T", " ")}
                </span>
              </div>
              {(step1Data.city || step1Data.venue) && (
                <div className="flex justify-between gap-4">
                  <span className="text-text-muted">地点</span>
                  <span className="text-right font-medium">
                    {[step1Data.city, step1Data.venue].filter(Boolean).join(" · ")}
                  </span>
                </div>
              )}
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
                className="flex-1 bg-brand-blue text-white hover:bg-brand-blue/90"
                disabled={submitting}
                onClick={() => void onCreate()}
              >
                {submitting ? "创建中..." : "创建活动"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
