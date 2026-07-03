"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import {
  CreationSection,
  creationStyles,
} from "@/components/admin/content-creation-layout";
import { CreationNumberStepper } from "@/components/admin/creation-number-stepper";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { InteractionEditLayout } from "@/components/interactions/InteractionEditLayout";
import { BoothLotteryPreview } from "@/components/lottery/BoothLotteryPreview";
import { LotteryCreationFooter } from "@/components/lottery/LotteryCreationFooter";
import {
  TierPrizeListEditor,
  type TierPrizeDraft,
} from "@/components/lottery/TierPrizeListEditor";
import { ScreenAnimationPicker } from "@/components/lottery/ScreenAnimationPicker";
import type {
  OrganizerLotteryDto,
  OrganizerLotteryEligibility,
  PrizeDrawOrder,
  ScreenAnimationType,
} from "@/lib/lottery/organizer-lottery-config";
import {
  defaultOrganizerEligibility,
  normalizeOrganizerEligibility,
} from "@/lib/lottery/organizer-lottery-config";
import type { EligibleCountResult } from "@/lib/lottery/organizer-lottery-service";
import { cn } from "@/lib/utils";

const DEFAULT_TIER_PRIZES: TierPrizeDraft[] = [
  { tier: 1, name: "iPhone 15 Pro", quantity: 1, prize_type: "PHYSICAL" },
  { tier: 2, name: "蓝牙耳机", quantity: 5, prize_type: "PHYSICAL" },
  { tier: 3, name: "定制礼品", quantity: 20, prize_type: "PHYSICAL" },
];

async function fetchGrandLottery(eventId: string) {
  const res = await fetch(
    `/api/events/${eventId}/lotteries?scope=organizer_grand`,
  );
  if (!res.ok) throw new Error("加载失败");
  const lotteries = (await res.json()).data.lotteries as OrganizerLotteryDto[];
  return lotteries[0] ?? null;
}

function buildEligibleQuery(
  eventId: string,
  lotteryId: string | undefined,
  eligibility: OrganizerLotteryEligibility,
  targetEntryCount: number | "",
) {
  const params = new URLSearchParams();
  if (lotteryId) params.set("lottery_id", lotteryId);
  params.set("require_checkin", eligibility.require_checkin ? "true" : "false");
  if (eligibility.min_interactions) {
    params.set("min_interactions", String(eligibility.min_interactions));
  }
  if (eligibility.require_stamp_rally) {
    params.set("require_stamp_rally", "true");
  }
  if (eligibility.stamp_rally_id) {
    params.set("stamp_rally_id", eligibility.stamp_rally_id);
  }
  if (eligibility.min_connections) {
    params.set("min_connections", String(eligibility.min_connections));
  }
  if (targetEntryCount !== "") {
    params.set("target_entry_count", String(targetEntryCount));
  }
  return `/api/events/${eventId}/lotteries/eligible-count?${params.toString()}`;
}

async function fetchEligibleCount(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("统计加载失败");
  return (await res.json()).data as EligibleCountResult;
}

export type OrganizerLotteryConfiguratorProps = {
  eventId: string;
  eventName: string;
};

export function OrganizerLotteryConfigurator({
  eventId,
  eventName,
}: OrganizerLotteryConfiguratorProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("闭幕全场大抽奖");
  const [description, setDescription] = useState("");
  const [drawAt, setDrawAt] = useState("");
  const [prizes, setPrizes] = useState<TierPrizeDraft[]>(DEFAULT_TIER_PRIZES);
  const [prizeDrawOrder, setPrizeDrawOrder] = useState<PrizeDrawOrder>("ASC");
  const [eligibility, setEligibility] = useState<OrganizerLotteryEligibility>(
    defaultOrganizerEligibility(),
  );
  const [screenAnimation, setScreenAnimation] =
    useState<ScreenAnimationType>("REVEAL_ONE_BY_ONE");
  const [targetEntryCount, setTargetEntryCount] = useState<number | "">("");
  const [lotteryId, setLotteryId] = useState<string | undefined>();
  const [savedLottery, setSavedLottery] = useState<OrganizerLotteryDto | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["organizer-grand-lottery", eventId],
    queryFn: () => fetchGrandLottery(eventId),
  });

  useEffect(() => {
    if (!existing) return;
    setSavedLottery(existing);
    setLotteryId(existing.id);
    setTitle(existing.title);
    setDescription(existing.description ?? "");
    setDrawAt(existing.draw_at ? existing.draw_at.slice(0, 16) : "");
    setPrizes(
      existing.prizes.map((p) => ({
        tier: p.tier ?? p.sort_order + 1,
        name: p.name,
        quantity: p.quantity,
        image_url: p.image_url,
        prize_type: p.prize_type as TierPrizeDraft["prize_type"],
      })),
    );
    setEligibility(normalizeOrganizerEligibility(existing.meta.eligibility));
    setScreenAnimation(existing.meta.screen_animation);
    setPrizeDrawOrder(existing.meta.prize_draw_order ?? "ASC");
    setTargetEntryCount(existing.meta.target_entry_count ?? "");
  }, [existing]);

  const eligibleUrl = useMemo(
    () =>
      buildEligibleQuery(
        eventId,
        lotteryId,
        eligibility,
        targetEntryCount,
      ),
    [eventId, lotteryId, eligibility, targetEntryCount],
  );

  const { data: stats, isFetching: statsFetching } = useQuery({
    queryKey: ["organizer-eligible-count", eligibleUrl],
    queryFn: () => fetchEligibleCount(eligibleUrl),
    refetchInterval: 15_000,
  });

  function patchEligibility(patch: Partial<OrganizerLotteryEligibility>) {
    setEligibility((prev) => ({ ...prev, ...patch }));
  }

  async function submit(publish: boolean) {
    if (!title.trim()) {
      toast.error("请填写抽奖名称");
      return;
    }
    if (prizes.some((p) => !p.name.trim())) {
      toast.error("请填写所有奖品名称");
      return;
    }

    if (publish) setSaving(true);
    else setSavingDraft(true);
    try {
      const payload = {
        owner_type: "ORGANIZER",
        ...(lotteryId ? { id: lotteryId } : {}),
        title,
        description: description || null,
        prizes: prizes.map((prize) => ({
          ...prize,
          image_url: prize.image_url || null,
        })),
        draw_at: drawAt ? new Date(drawAt).toISOString() : null,
        eligibility: normalizeOrganizerEligibility(eligibility),
        screen_animation: screenAnimation,
        prize_draw_order: prizeDrawOrder,
        target_entry_count:
          targetEntryCount === "" ? null : Number(targetEntryCount),
        publish,
      };

      const res = await fetch(`/api/events/${eventId}/lotteries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");

      const lottery = json.data as OrganizerLotteryDto;
      setLotteryId(lottery.id);
      setSavedLottery(lottery);
      toast.success(publish ? "全场大抽奖已发布" : "草稿已保存");
      void queryClient.invalidateQueries({
        queryKey: ["organizer-grand-lottery", eventId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["organizer-eligible-count"],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
      setSavingDraft(false);
    }
  }

  const statusBadge =
    savedLottery?.status === "OPEN" ? (
      <Badge className="bg-brand-green-light font-normal text-brand-green">
        已开放报名
      </Badge>
    ) : savedLottery?.status === "FINISHED" ? (
      <Badge className="bg-gray-100 font-normal text-text-muted">已结束</Badge>
    ) : (
      <Badge className="bg-brand-amber-light font-normal text-brand-amber">
        草稿
      </Badge>
    );

  return (
    <AdminPage>
      <AdminHeader
        title="闭幕全场大抽奖"
        description={eventName}
        breadcrumb={["互动管理", "全场抽奖"]}
        actions={
          savedLottery?.status === "OPEN" ? (
            <Link
              href={`/events/${eventId}/screen/lottery?lottery=${savedLottery.id}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-gold px-3 text-sm font-medium text-white hover:bg-brand-gold/90"
            >
              <ExternalLink className="size-4" />
              大屏开奖控制台
            </Link>
          ) : null
        }
      />

      <AdminContent className="p-0">
        {isLoading ? (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        ) : (
          <InteractionEditLayout
            editor={
              <>
                {savedLottery && (
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    {statusBadge}
                    <span className="text-sm text-text-muted">
                      已报名 {savedLottery.entry_count} 人
                    </span>
                  </div>
                )}

                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="2025 闭幕全场大抽奖"
                  className={creationStyles.titleInput}
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="向参会者说明参与方式与开奖时间"
                  className={cn(creationStyles.descriptionInput, "mt-2")}
                  rows={2}
                />

                <CreationSection hint="计划开奖时间">
                  <Input
                    type="datetime-local"
                    value={drawAt}
                    onChange={(e) => setDrawAt(e.target.value)}
                    className="h-12 max-w-md text-base"
                  />
                </CreationSection>

                <CreationSection
                  hint="奖品等级"
                  description="按等级分组配置，数字越小等级越高（1=一等奖）"
                >
                  <TierPrizeListEditor prizes={prizes} onChange={setPrizes} />
                </CreationSection>

                <CreationSection
                  hint="开奖顺序"
                  description="控制大屏开奖时的揭晓节奏"
                >
                  <div className="space-y-3">
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3",
                        prizeDrawOrder === "ASC"
                          ? "border-brand-blue bg-brand-blue-light/20"
                          : "border-border-light",
                      )}
                    >
                      <input
                        type="radio"
                        name="prize_draw_order"
                        className="mt-1"
                        checked={prizeDrawOrder === "ASC"}
                        onChange={() => setPrizeDrawOrder("ASC")}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          从低等级到高等级依次开奖
                        </p>
                        <p className="text-xs text-text-muted">
                          先开三等奖，最后压轴一等奖，制造悬念（推荐）
                        </p>
                      </div>
                    </label>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3",
                        prizeDrawOrder === "ALL_AT_ONCE"
                          ? "border-brand-blue bg-brand-blue-light/20"
                          : "border-border-light",
                      )}
                    >
                      <input
                        type="radio"
                        name="prize_draw_order"
                        className="mt-1"
                        checked={prizeDrawOrder === "ALL_AT_ONCE"}
                        onChange={() => setPrizeDrawOrder("ALL_AT_ONCE")}
                      />
                      <div>
                        <p className="text-sm font-medium">一次性全部开奖</p>
                        <p className="text-xs text-text-muted">
                          不分等级步骤，按顺序连续揭晓所有中奖者
                        </p>
                      </div>
                    </label>
                  </div>
                </CreationSection>

                <CreationSection
                  hint="参与门槛"
                  description="勾选的所有条件须同时满足（AND），驱动参会者完成更多活动行为"
                >
                  <div className="space-y-4">
                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light px-4 py-3">
                      <Checkbox
                        checked={eligibility.require_checkin}
                        onCheckedChange={(checked) =>
                          patchEligibility({ require_checkin: checked === true })
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">已完成签到</p>
                        <p className="text-xs text-text-muted">
                          仅限已到场签到的参会者
                        </p>
                      </div>
                    </label>

                    <div className="rounded-lg border border-border-light px-4 py-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={eligibility.min_interactions != null}
                          onCheckedChange={(checked) =>
                            patchEligibility({
                              min_interactions: checked ? 2 : null,
                            })
                          }
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            参与了至少 X 个互动（投票/问答）
                          </p>
                          {eligibility.min_interactions != null && (
                            <div className="mt-3">
                              <CreationNumberStepper
                                value={eligibility.min_interactions}
                                min={1}
                                max={50}
                                onChange={(min_interactions) =>
                                  patchEligibility({ min_interactions })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </label>
                    </div>

                    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border-light px-4 py-3">
                      <Checkbox
                        checked={eligibility.require_stamp_rally}
                        onCheckedChange={(checked) =>
                          patchEligibility({
                            require_stamp_rally: checked === true,
                          })
                        }
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium">集满全场集章路线</p>
                        <p className="text-xs text-text-muted">
                          需完成当前进行中的主办方集章活动
                        </p>
                      </div>
                    </label>

                    <div className="rounded-lg border border-border-light px-4 py-3">
                      <label className="flex cursor-pointer items-start gap-3">
                        <Checkbox
                          checked={eligibility.min_connections != null}
                          onCheckedChange={(checked) =>
                            patchEligibility({
                              min_connections: checked ? 3 : null,
                            })
                          }
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            采集了至少 X 个名片/连接
                          </p>
                          {eligibility.min_connections != null && (
                            <div className="mt-3">
                              <CreationNumberStepper
                                value={eligibility.min_connections}
                                min={1}
                                max={50}
                                onChange={(min_connections) =>
                                  patchEligibility({ min_connections })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                </CreationSection>

                <CreationSection hint="开奖仪式" description="大屏动画风格">
                  <ScreenAnimationPicker
                    value={screenAnimation}
                    onChange={setScreenAnimation}
                  />
                  {prizeDrawOrder === "ASC" && (
                    <p className="mt-3 text-sm text-text-muted">
                      分级模式下，控制台将按等级分步操作：「开始 X 等奖抽奖」→
                      揭晓 → 下一等级。
                    </p>
                  )}
                </CreationSection>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setStatsOpen((v) => !v)}
                    className="flex items-center gap-1 text-sm text-text-muted"
                  >
                    实时数据
                    <span className={cn("transition-transform", statsOpen && "rotate-180")}>
                      ▾
                    </span>
                  </button>
                  {statsOpen && (
                    <div className="mt-3 space-y-3 rounded-xl border border-border-light bg-content-bg/30 p-5">
                      {statsFetching ? (
                        <Loader2 className="size-4 animate-spin text-text-muted" />
                      ) : null}
                      <div className="rounded-xl border border-brand-blue/20 bg-brand-blue-light/30 p-4">
                        <div className="flex items-center gap-2 text-text-muted">
                          <Users className="size-4" />
                          <span className="text-xs">符合条件人数</span>
                        </div>
                        <p className="mt-1 text-3xl font-bold text-brand-blue">
                          {stats?.eligible_count ?? "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          占参会者 {stats?.percentage ?? 0}%
                        </p>
                      </div>
                      <div className="rounded-xl border border-border-light p-4">
                        <p className="text-xs text-text-muted">已报名参与</p>
                        <p className="mt-1 text-2xl font-bold">
                          {stats?.entered_count ?? savedLottery?.entry_count ?? 0}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs text-text-muted">目标参与人数（选填）</p>
                        {targetEntryCount === "" ? (
                          <button
                            type="button"
                            onClick={() => setTargetEntryCount(200)}
                            className="text-sm text-brand-blue hover:underline"
                          >
                            + 设置目标人数
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <CreationNumberStepper
                              value={Number(targetEntryCount)}
                              min={1}
                              onChange={setTargetEntryCount}
                            />
                            <button
                              type="button"
                              onClick={() => setTargetEntryCount("")}
                              className="text-xs text-text-muted hover:text-text-primary"
                            >
                              清除
                            </button>
                          </div>
                        )}
                      </div>
                      {stats?.target_entry_count && stats.vs_target != null && (
                        <div
                          className={cn(
                            "rounded-lg px-3 py-2 text-sm",
                            stats.vs_target >= 100
                              ? "bg-brand-green-light text-brand-green"
                              : stats.vs_target >= 60
                                ? "bg-brand-amber-light text-brand-amber"
                                : "bg-red-50 text-red-600",
                          )}
                        >
                          已达目标 {stats.vs_target}%
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            }
            preview={
              <BoothLotteryPreview
                eventName={eventName}
                title={title}
                description={description}
                prizes={prizes}
                submitLabel="报名参与"
              />
            }
            footer={
              <LotteryCreationFooter
                saving={saving}
                savingDraft={savingDraft}
                onSaveDraft={() => void submit(false)}
                onPublish={() => void submit(true)}
                publishLabel="发布"
              />
            }
          />
        )}
      </AdminContent>
    </AdminPage>
  );
}
