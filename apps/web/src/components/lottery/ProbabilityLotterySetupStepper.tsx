"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { CreationSection, creationStyles } from "@/components/admin/content-creation-layout";
import { MobileDevicePreview } from "@/components/admin/mobile-device-preview";
import { InteractionEditLayout } from "@/components/interactions/InteractionEditLayout";
import { Textarea } from "@/components/ui/textarea";
import { AnimationTypePicker } from "@/components/lottery/AnimationTypePicker";
import { LotteryCreationFooter } from "@/components/lottery/LotteryCreationFooter";
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
  const [savingDraft, setSavingDraft] = useState(false);
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

  function validateAll(): boolean {
    if (!title.trim()) {
      toast.error("请填写抽奖名称");
      return false;
    }
    if (triggerAction === TriggerAction.SURVEY && !pollId) {
      toast.error("请选择关联问卷");
      return false;
    }
    if (!isProbabilityConfigValid(prizes)) {
      toast.error("请检查奖品与概率配置（总和不可超过 100%）");
      return false;
    }
    return true;
  }

  async function submit(publish: boolean) {
    if (!validateAll()) return;

    if (publish) setPublishing(true);
    else setSavingDraft(true);

    try {
      const payload = buildProbabilityLotteryPayload({
        title,
        description,
        trigger_action: triggerAction,
        require_poll_id: pollId || null,
        animation_type: animationType,
        prizes,
        publish,
      });

      const res = await fetch(`/api/booths/${boothId}/lotteries/probability`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");

      toast.success(publish ? "概率抽奖已发布" : "已保存草稿");
      const lotteryId = json.data?.lottery?.id as string | undefined;
      if (lotteryId) {
        router.push(
          `/events/${eventId}/booths/${boothId}/lottery/${lotteryId}`,
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setPublishing(false);
      setSavingDraft(false);
    }
  }

  const animationMeta = ANIMATION_TYPE_OPTIONS.find(
    (o) => o.value === animationType,
  );
  const thanksPercent = remainingProbabilityPercent(prizes);
  const triggerLabel = TRIGGER_ACTION_OPTIONS.find(
    (t) => t.value === triggerAction,
  )?.title;

  return (
    <AdminPage>
      <AdminHeader
        title="创建概率抽奖"
        description={`${companyName} · ${boothCode} · 行为触发`}
        breadcrumb={["活动", boothName, "概率抽奖"]}
        actions={
          <Link
            href={`/events/${eventId}/booths/${boothId}/lottery/new`}
            className="inline-flex h-8 items-center rounded-lg border border-border-light px-3 text-sm hover:bg-gray-50"
          >
            其他类型
          </Link>
        }
      />

      <AdminContent className="p-0">
        <InteractionEditLayout
          editor={
            <>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="概率抽奖名称"
                className={creationStyles.titleInput}
              />
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="说明（选填）"
                className={cn(creationStyles.descriptionInput, "mt-2")}
                rows={2}
              />

              <CreationSection
                hint="触发方式"
                description="用户完成什么动作后自动抽奖"
              >
                <div className="space-y-3">
                  {TRIGGER_ACTION_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={cn(
                        creationStyles.choiceCard,
                        triggerAction === opt.value
                          ? creationStyles.choiceCardActive
                          : creationStyles.choiceCardIdle,
                      )}
                    >
                      <input
                        type="radio"
                        name="trigger"
                        className="mt-1.5 size-4"
                        checked={triggerAction === opt.value}
                        onChange={() => setTriggerAction(opt.value)}
                      />
                      <div>
                        <p className="text-base font-medium">{opt.title}</p>
                        <p className="mt-0.5 text-sm text-text-muted">
                          {opt.description}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>

                {triggerAction === TriggerAction.FILL_FORM ? (
                  <div className="mt-4 rounded-xl border border-dashed border-border-light px-5 py-4 text-sm text-text-muted">
                    将使用展位留资字段引擎。
                    <Link
                      href={`/events/${eventId}/exhibitors/booths`}
                      className="ml-1 inline-flex items-center gap-1 text-brand-blue hover:underline"
                    >
                      管理留资字段
                      <ExternalLink className="size-3" />
                    </Link>
                  </div>
                ) : null}

                {triggerAction === TriggerAction.SURVEY ? (
                  <div className="mt-4 space-y-2">
                    <p className={creationStyles.sectionHint}>关联问卷</p>
                    {pollsLoading ? (
                      <p className="text-sm text-text-muted">加载问卷…</p>
                    ) : polls.length === 0 ? (
                      <p className="text-sm text-text-muted">
                        暂无可用问卷，请先在活动中创建 Poll
                      </p>
                    ) : (
                      <select
                        className="h-12 w-full rounded-xl border border-border-light px-4 text-base"
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
                ) : null}
              </CreationSection>

              <CreationSection hint="抽奖动效" description="小程序端展示的动画">
                <AnimationTypePicker
                  value={animationType}
                  onChange={setAnimationType}
                />
              </CreationSection>

              <CreationSection
                hint="奖品与概率"
                description="拖动滑块分配概率，剩余部分为谢谢参与"
              >
                <ProbabilityConfigList prizes={prizes} onChange={setPrizes} />
              </CreationSection>
            </>
          }
          preview={
            <MobileDevicePreview width={280} dark>
              <div className="text-center">
                <p className="text-xs text-white/40">{companyName}</p>
                <p className="mt-2 text-lg font-bold">{title || "概率抽奖"}</p>
                <p className="mt-1 text-sm text-white/60">
                  {animationMeta?.emoji} {animationMeta?.title}
                </p>
              </div>

              <ul className="mt-5 space-y-2">
                {prizes.map((prize, index) => (
                  <li
                    key={`${prize.name}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                  >
                    {prize.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={prize.image_url}
                        alt=""
                        className="size-10 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex size-10 items-center justify-center rounded-lg bg-white/10 text-lg">
                        🎁
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {prize.name || "奖品"}
                      </p>
                      <p className="text-xs text-white/45">
                        × {prize.quantity} · {prize.probability_percent.toFixed(1)}%
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex min-h-[100px] flex-col items-center justify-center rounded-xl bg-white/5 p-4">
                <span className="text-5xl">{animationMeta?.emoji}</span>
                <p className="mt-2 text-xs text-brand-gold">
                  中奖率约 {(100 - thanksPercent).toFixed(0)}%
                </p>
              </div>
              {triggerLabel ? (
                <p className="mt-4 text-center text-[11px] text-white/35">
                  触发：{triggerLabel}
                </p>
              ) : null}
            </MobileDevicePreview>
          }
          footer={
            <LotteryCreationFooter
              saving={publishing}
              savingDraft={savingDraft}
              onSaveDraft={() => void submit(false)}
              onPublish={() => void submit(true)}
              publishLabel="发布"
            />
          }
        />
      </AdminContent>
    </AdminPage>
  );
}
