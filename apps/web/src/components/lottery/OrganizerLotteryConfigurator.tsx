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
  SectionCard,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PrizeListEditor } from "@/components/lottery/PrizeListEditor";
import { ScreenAnimationPicker } from "@/components/lottery/ScreenAnimationPicker";
import type { BoothLotteryPrizeDraft } from "@/lib/lottery/booth-lottery-schemas";
import type {
  OrganizerLotteryDto,
  OrganizerLotteryEligibility,
  ScreenAnimationType,
} from "@/lib/lottery/organizer-lottery-config";
import {
  defaultOrganizerEligibility,
  normalizeOrganizerEligibility,
} from "@/lib/lottery/organizer-lottery-config";
import type { EligibleCountResult } from "@/lib/lottery/organizer-lottery-service";
import { cn } from "@/lib/utils";

const DEFAULT_PRIZES: BoothLotteryPrizeDraft[] = [
  { name: "参与奖", quantity: 10, prize_type: "PHYSICAL" },
  { name: "三等奖", quantity: 3, prize_type: "PHYSICAL" },
  { name: "二等奖", quantity: 2, prize_type: "PHYSICAL" },
  { name: "一等奖", quantity: 1, prize_type: "PHYSICAL" },
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
  const [prizes, setPrizes] = useState<BoothLotteryPrizeDraft[]>(DEFAULT_PRIZES);
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
        name: p.name,
        quantity: p.quantity,
        image_url: p.image_url,
        prize_type: p.prize_type as BoothLotteryPrizeDraft["prize_type"],
      })),
    );
    setEligibility(normalizeOrganizerEligibility(existing.meta.eligibility));
    setScreenAnimation(existing.meta.screen_animation);
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

    setSaving(true);
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

      <AdminContent>
        {isLoading ? (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="space-y-6">
              {savedLottery && (
                <div className="flex flex-wrap items-center gap-2">
                  {statusBadge}
                  <span className="text-sm text-text-muted">
                    已报名 {savedLottery.entry_count} 人
                  </span>
                </div>
              )}

              <SectionCard
                title="基础信息"
                description="通常在活动闭幕时举行，仪式感最强"
              >
                <div className="space-y-4 p-5">
                  <div className="space-y-2">
                    <Label>抽奖名称</Label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="2025 闭幕全场大抽奖"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>说明</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="向参会者说明参与方式与开奖时间"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>计划开奖时间（选填）</Label>
                    <Input
                      type="datetime-local"
                      value={drawAt}
                      onChange={(e) => setDrawAt(e.target.value)}
                    />
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="奖品设置"
                description="按从小奖到大奖排列，开奖时由低到高揭晓"
              >
                <div className="p-5">
                  <PrizeListEditor prizes={prizes} onChange={setPrizes} />
                </div>
              </SectionCard>

              <SectionCard
                title="参与门槛"
                description="勾选的所有条件须同时满足（AND），驱动参会者完成更多活动行为"
              >
                <div className="space-y-4 p-5">
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
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              className="h-8 w-20"
                              value={eligibility.min_interactions}
                              onChange={(e) =>
                                patchEligibility({
                                  min_interactions: Number(e.target.value),
                                })
                              }
                            />
                            <span className="text-xs text-text-muted">次</span>
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
                          <div className="mt-2 flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={50}
                              className="h-8 w-20"
                              value={eligibility.min_connections}
                              onChange={(e) =>
                                patchEligibility({
                                  min_connections: Number(e.target.value),
                                })
                              }
                            />
                            <span className="text-xs text-text-muted">个</span>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="开奖仪式"
                description="大屏动画风格 · 开奖顺序：从小奖到大奖"
              >
                <div className="space-y-4 p-5">
                  <ScreenAnimationPicker
                    value={screenAnimation}
                    onChange={setScreenAnimation}
                  />
                  <p className="text-xs text-text-muted">
                    奖品将按上方列表顺序从参与奖到一等奖依次揭晓，制造递进期待感。
                  </p>
                </div>
              </SectionCard>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={saving}
                  onClick={() => void submit(false)}
                >
                  保存草稿
                </Button>
                <Button
                  className="bg-brand-blue text-white hover:bg-brand-blue/90"
                  disabled={saving}
                  onClick={() => void submit(true)}
                >
                  {saving ? "保存中…" : "发布并开放报名"}
                </Button>
              </div>
            </div>

            <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <SectionCard
                title="实时状态"
                description="每 15 秒自动刷新"
                action={
                  statsFetching ? (
                    <Loader2 className="size-4 animate-spin text-text-muted" />
                  ) : null
                }
              >
                <div className="space-y-4 p-5">
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
                    <Label className="text-xs">目标参与人数（选填）</Label>
                    <Input
                      type="number"
                      min={1}
                      placeholder="如 200"
                      value={targetEntryCount}
                      onChange={(e) =>
                        setTargetEntryCount(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                    />
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
                      {stats.vs_target < 100 && " · 可调整门槛或加强宣传"}
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-text-muted">
                    符合条件 {stats?.eligible_count ?? "—"} 人 / 活动参会者{" "}
                    {stats?.total_participants ?? "—"} 人。门槛越高，最终开奖规模越小但质量越高。
                  </p>
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </AdminContent>
    </AdminPage>
  );
}
