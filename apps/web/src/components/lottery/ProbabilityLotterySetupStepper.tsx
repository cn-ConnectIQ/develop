"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AnimationTypePicker } from "@/components/lottery/AnimationTypePicker";
import {
  isProbabilityConfigValid,
  ProbabilityConfigList,
} from "@/components/lottery/ProbabilityConfigList";
import { buildProbabilityLotteryPayload } from "@/lib/lottery/booth-probability-lottery-schemas";
import {
  AnimationType,
  ANIMATION_TYPE_OPTIONS,
  type AnimationTypeValue,
  type ProbabilityPrizeDraft,
  remainingProbabilityPercent,
  TRIGGER_ACTION_OPTIONS,
  TriggerAction,
  type TriggerActionValue,
} from "@/lib/lottery/probability-lottery-config";
import { cn } from "@/lib/utils";

const STEPS = ["触发方式", "选择动效", "奖品与概率", "预览与发布"] as const;

const DEFAULT_PRIZES: ProbabilityPrizeDraft[] = [
  { name: "iPhone 壳", quantity: 10, probability_percent: 15, prize_type: "PHYSICAL" },
  { name: "优惠券", quantity: 50, probability_percent: 25, prize_type: "DIGITAL" },
];

type PollOption = { id: string; title: string; type: string; status: string };

export type ProbabilityLotterySetupStepperProps = {
  eventId: string;
  boothId: string;
  boothCode: string;
  boothName: string;
  companyName: string;
};

export function ProbabilityLotterySetupStepper({
  eventId,
  boothId,
  boothCode,
  boothName,
  companyName,
}: ProbabilityLotterySetupStepperProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState(`${boothCode} 概率抽奖`);
  const [description, setDescription] = useState("");
  const [triggerAction, setTriggerAction] = useState<TriggerActionValue>(
    TriggerAction.FILL_FORM,
  );
  const [pollId, setPollId] = useState("");
  const [polls, setPolls] = useState<PollOption[]>([]);
  const [pollsLoading, setPollsLoading] = useState(false);
  const [animationType, setAnimationType] = useState<AnimationTypeValue>(
    AnimationType.WHEEL,
  );
  const [prizes, setPrizes] = useState<ProbabilityPrizeDraft[]>(DEFAULT_PRIZES);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (triggerAction !== TriggerAction.SURVEY) return;
    setPollsLoading(true);
    void fetch(`/api/events/${eventId}/polls?scope=admin`)
      .then((res) => res.json())
      .then((json) => {
        const list = (json.data?.polls ?? []) as PollOption[];
        setPolls(list.filter((p) => p.type !== "LOTTERY"));
      })
      .catch(() => toast.error("加载问卷列表失败"))
      .finally(() => setPollsLoading(false));
  }, [eventId, triggerAction]);

  function validateStep(index: number): boolean {
    if (index === 0) {
      if (!title.trim()) {
        toast.error("请填写抽奖名称");
        return false;
      }
      if (triggerAction === TriggerAction.SURVEY && !pollId) {
        toast.error("请选择关联问卷");
        return false;
      }
    }
    if (index === 2) {
      if (!isProbabilityConfigValid(prizes)) {
        toast.error("请检查奖品与概率配置（总和不可超过 100%）");
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function handlePublish() {
    if (!validateStep(0) || !validateStep(2)) return;

    setPublishing(true);
    try {
      const payload = buildProbabilityLotteryPayload({
        title,
        description,
        trigger_action: triggerAction,
        require_poll_id: pollId || null,
        animation_type: animationType,
        prizes,
        publish: true,
      });

      const res = await fetch(`/api/booths/${boothId}/lotteries/probability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "发布失败");

      toast.success("概率抽奖已发布");
      const lotteryId = json.data?.lottery?.id as string | undefined;
      if (lotteryId) {
        router.push(
          `/events/${eventId}/booths/${boothId}/lottery/${lotteryId}`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发布失败");
    } finally {
      setPublishing(false);
    }
  }

  const animationMeta = ANIMATION_TYPE_OPTIONS.find(
    (o) => o.value === animationType,
  );
  const thanksPercent = remainingProbabilityPercent(prizes);

  return (
    <AdminPage>
      <AdminHeader
        title="创建概率抽奖"
        description={`${companyName} · ${boothCode} · 类型② 行为触发`}
        breadcrumb={["活动", boothName, "概率抽奖"]}
        actions={
          <Link
            href={`/events/${eventId}/booths/${boothId}/lottery/new`}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-light px-3 text-sm hover:bg-gray-50"
          >
            <ArrowLeft className="size-4" />
            其他类型
          </Link>
        }
      />

      <AdminContent>
        <div className="mb-8 flex items-center gap-2">
          {STEPS.map((label, index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  index < step
                    ? "bg-brand-green text-white"
                    : index === step
                      ? "bg-brand-blue text-white"
                      : "bg-gray-100 text-text-muted",
                )}
              >
                {index < step ? <Check className="size-4" /> : index + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:inline",
                  index === step ? "text-text-primary" : "text-text-muted",
                )}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <div className="mx-1 h-px flex-1 bg-border-light" />
              )}
            </div>
          ))}
        </div>

        {step === 0 && (
          <SectionCard title="Step 1 · 触发方式" description="用户完成什么动作后自动抽奖">
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <Label>抽奖名称</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>说明（选填）</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-3">
                {TRIGGER_ACTION_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3",
                      triggerAction === opt.value
                        ? "border-brand-green bg-brand-green-light/20"
                        : "border-border-light",
                    )}
                  >
                    <input
                      type="radio"
                      name="trigger"
                      className="mt-1"
                      checked={triggerAction === opt.value}
                      onChange={() => setTriggerAction(opt.value)}
                    />
                    <div>
                      <p className="text-sm font-medium">{opt.title}</p>
                      <p className="text-xs text-text-muted">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>

              {triggerAction === TriggerAction.FILL_FORM && (
                <div className="rounded-lg border border-dashed border-border-light px-4 py-3 text-sm">
                  <p className="text-text-muted">
                    将使用展位 SYS-01 留资字段引擎。可在移动端表单配置中管理字段。
                  </p>
                  <Link
                    href={`/events/${eventId}/exhibitors/booths`}
                    className="mt-2 inline-flex items-center gap-1 text-brand-blue hover:underline"
                  >
                    管理留资字段
                    <ExternalLink className="size-3" />
                  </Link>
                </div>
              )}

              {triggerAction === TriggerAction.SURVEY && (
                <div className="space-y-2">
                  <Label>关联问卷</Label>
                  {pollsLoading ? (
                    <p className="text-sm text-text-muted">加载问卷…</p>
                  ) : polls.length === 0 ? (
                    <p className="text-sm text-text-muted">
                      暂无可用问卷，请先在活动中创建 Poll
                    </p>
                  ) : (
                    <select
                      className="h-10 w-full rounded-lg border border-border-light px-3 text-sm"
                      value={pollId}
                      onChange={(e) => setPollId(e.target.value)}
                    >
                      <option value="">请选择问卷</option>
                      {polls.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} ({p.status})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {step === 1 && (
          <SectionCard title="Step 2 · 选择动效" description="小程序端展示的抽奖动画">
            <div className="p-5">
              <AnimationTypePicker
                value={animationType}
                onChange={setAnimationType}
              />
            </div>
          </SectionCard>
        )}

        {step === 2 && (
          <SectionCard
            title="Step 3 · 奖品与概率"
            description="拖动滑块分配概率，剩余部分为谢谢参与"
          >
            <div className="p-5">
              <ProbabilityConfigList prizes={prizes} onChange={setPrizes} />
            </div>
          </SectionCard>
        )}

        {step === 3 && (
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Step 4 · 手机预览" description="发布前效果示意">
              <div className="flex justify-center p-6">
                <div className="w-[280px] rounded-[2rem] border-8 border-gray-800 bg-[#0a0a12] p-4 shadow-xl">
                  <div className="mb-4 text-center">
                    <p className="text-xs text-white/40">{title}</p>
                    <p className="mt-1 text-lg font-bold text-white">
                      {animationMeta?.emoji} {animationMeta?.title}
                    </p>
                  </div>
                  <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl bg-white/5 p-4">
                    <span className="text-4xl">{animationMeta?.emoji}</span>
                    <p className="mt-3 text-center text-sm text-white/70">
                      {prizes[0]?.name ?? "奖品"} 等 {prizes.length} 个奖项
                    </p>
                    <p className="mt-1 text-xs text-brand-gold">
                      中奖率约 {(100 - thanksPercent).toFixed(0)}%
                    </p>
                  </div>
                  <p className="mt-4 text-center text-[10px] text-white/30">
                    {TRIGGER_ACTION_OPTIONS.find((t) => t.value === triggerAction)
                      ?.title}
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="发布确认">
              <div className="space-y-3 p-5 text-sm">
                <p>
                  <span className="text-text-muted">动效：</span>
                  {animationMeta?.title}
                </p>
                <p>
                  <span className="text-text-muted">奖品数：</span>
                  {prizes.length} 个，谢谢参与 {thanksPercent.toFixed(1)}%
                </p>
                <Button
                  className="mt-4 w-full bg-brand-green text-white hover:bg-brand-green/90"
                  disabled={publishing}
                  onClick={() => void handlePublish()}
                >
                  {publishing ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : null}
                  发布（status=ACTIVE）
                </Button>
              </div>
            </SectionCard>
          </div>
        )}

        <div className="mt-8 flex justify-between">
          <Button
            variant="outline"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
          >
            <ArrowLeft className="mr-2 size-4" />
            上一步
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={goNext}>
              下一步
              <ArrowRight className="ml-2 size-4" />
            </Button>
          ) : null}
        </div>
      </AdminContent>
    </AdminPage>
  );
}
