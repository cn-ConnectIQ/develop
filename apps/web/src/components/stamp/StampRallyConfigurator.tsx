"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MapPin, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  CreationSection,
  creationStyles,
} from "@/components/admin/content-creation-layout";
import { CreationNumberStepper } from "@/components/admin/creation-number-stepper";
import { PrizeImageDropzone } from "@/components/admin/prize-image-dropzone";
import { InteractionEditLayout } from "@/components/interactions/InteractionEditLayout";
import { resolveMediaUrl } from "@/lib/public-path";
import { LotteryCreationFooter } from "@/components/lottery/LotteryCreationFooter";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  StampPointTable,
  type BoothOption,
} from "@/components/stamp/StampPointTable";
import { StampRallyStats } from "@/components/stamp/StampRallyStats";
import type { StampPointConfig } from "@/lib/stamp/stamp-rally-config";
import {
  computeWeightedRequired,
  extractBoothIdsFromStampPoints,
  isBoothStampPoint,
  normalizeStampPoints,
  stampPointClientKey,
} from "@/lib/stamp/stamp-rally-config";
import type { ApiStampRally } from "@/lib/stamp-rally-service";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "草稿", className: "bg-brand-amber-light text-brand-amber" },
  ACTIVE: {
    label: "进行中",
    className: "bg-brand-green-light text-brand-green",
  },
  ENDED: { label: "已结束", className: "bg-gray-100 text-text-muted" },
};

async function fetchRallies(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/stamp-rallies`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.rallies as ApiStampRally[];
}

async function fetchBooths(eventId: string) {
  const res = await fetch(
    `/api/events/${eventId}/stamp-rallies?include=booths`,
  );
  if (!res.ok) throw new Error("加载展位失败");
  return (await res.json()).data.booths as BoothOption[];
}

function StampPassportPreview({
  name,
  coverImage,
  description,
  prize,
  prizeImageUrl,
  requiredCount,
  stamps,
}: {
  name: string;
  coverImage: string | null;
  description: string;
  prize: string;
  prizeImageUrl: string | null;
  requiredCount: number;
  stamps: StampPointConfig[];
}) {
  const collected = Math.min(2, stamps.length);
  const coverSrc = resolveMediaUrl(coverImage);
  const prizeSrc = resolveMediaUrl(prizeImageUrl);

  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-border-light bg-gradient-to-b from-brand-blue-light/40 to-white shadow-lg">
      {coverSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverSrc}
          alt=""
          className="h-28 w-full object-cover"
        />
      ) : (
        <div className="flex h-28 items-center justify-center bg-brand-blue/10">
          <MapPin className="size-10 text-brand-blue/40" />
        </div>
      )}

      <div className="p-4">
        <h3 className="text-lg font-bold text-[var(--admin-ink)]">
          {name || "集章路线名称"}
        </h3>
        {description && (
          <p className="mt-1 text-xs text-text-muted line-clamp-2">
            {description}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-lg bg-white/80 p-2">
          {prizeSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prizeSrc}
              alt=""
              className="size-10 rounded-lg object-cover"
            />
          ) : (
            <div className="flex size-10 items-center justify-center rounded-lg bg-brand-gold/20">
              <Trophy className="size-5 text-brand-gold" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-text-muted">兑换奖品</p>
            <p className="truncate text-sm font-medium">
              {prize || "填写奖品名称"}
            </p>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-text-muted">
            <span>集章进度（预览）</span>
            <span>
              {collected}/{requiredCount || "?"}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-brand-green"
              style={{
                width: `${requiredCount ? (collected / requiredCount) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          {stamps.length === 0 ? (
            <p className="col-span-3 py-6 text-center text-xs text-text-muted">
              添加打卡点后在此预览
            </p>
          ) : (
            stamps.map((stamp, i) => {
              const stamped = i < collected;
              const isEmoji =
                stamp.icon &&
                !stamp.icon.startsWith("http") &&
                !stamp.icon.startsWith("/");

              return (
                <div
                  key={stampPointClientKey(stamp)}
                  className={cn(
                    "flex flex-col items-center rounded-xl border p-2 text-center transition-colors",
                    stamped
                      ? "border-brand-green bg-brand-green-light/50"
                      : "border-border-light bg-white/60 opacity-70",
                  )}
                >
                  <span className="text-2xl">
                    {isEmoji ? (
                      stamp.icon
                    ) : stamp.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={stamp.icon}
                        alt=""
                        className="mx-auto size-8 rounded object-cover"
                      />
                    ) : (
                      "⭐"
                    )}
                  </span>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-tight">
                    {stamp.name}
                  </p>
                  {stamp.weight > 1 && (
                    <span className="mt-0.5 text-[9px] text-brand-blue">
                      ×{stamp.weight}
                    </span>
                  )}
                  {!stamp.required && (
                    <span className="mt-0.5 text-[9px] text-text-muted">
                      可选
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export type StampRallyConfiguratorProps = {
  eventId: string;
  eventName: string;
  /** @deprecated Use mode + rallyId instead */
  initialRallyId?: string | null;
  mode?: "create" | "edit";
  rallyId?: string;
};

export function StampRallyConfigurator({
  eventId,
  eventName,
  initialRallyId,
  mode,
  rallyId,
}: StampRallyConfiguratorProps) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const listHref = `/events/${eventId}/stamp-rally`;
  const lockedId =
    mode === "create"
      ? ("new" as const)
      : mode === "edit" && rallyId
        ? rallyId
        : initialRallyId ?? "new";

  const [selectedId, setSelectedId] = useState<string | "new">(lockedId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [prize, setPrize] = useState("");
  const [prizeImageUrl, setPrizeImageUrl] = useState<string | null>(null);
  const [prizeDesc, setPrizeDesc] = useState("");
  const [prizeQuantity, setPrizeQuantity] = useState<number | "">("");
  const [requiredCount, setRequiredCount] = useState(3);
  const [stampPoints, setStampPoints] = useState<StampPointConfig[]>([]);
  const [alwaysOpen, setAlwaysOpen] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const { data: rallies = [], isLoading: ralliesLoading } = useQuery({
    queryKey: ["stamp-rallies", eventId],
    queryFn: () => fetchRallies(eventId),
  });

  const { data: booths = [] } = useQuery({
    queryKey: ["stamp-rally-booths", eventId],
    queryFn: () => fetchBooths(eventId),
  });

  const editingRally =
    selectedId !== "new"
      ? rallies.find((r) => r.id === selectedId) ?? null
      : null;

  const isLocked = editingRally?.status === "ACTIVE";

  useEffect(() => {
    if (selectedId === "new") {
      setName("");
      setDescription("");
      setCoverImage(null);
      setPrize("");
      setPrizeImageUrl(null);
      setPrizeDesc("");
      setPrizeQuantity("");
      setRequiredCount(3);
      setStampPoints([]);
      setAlwaysOpen(true);
      setStartsAt("");
      setEndsAt("");
      return;
    }

    const rally = rallies.find((r) => r.id === selectedId);
    if (!rally) return;

    setName(rally.name);
    setDescription(rally.description ?? "");
    setCoverImage(rally.cover_image);
    setPrize(rally.prize);
    setPrizeImageUrl(rally.prize_image_url);
    setPrizeDesc(rally.prize_desc ?? "");
    setPrizeQuantity(rally.prize_quantity ?? "");
    setRequiredCount(rally.required_count);
    setStampPoints(normalizeStampPoints(rally.booth_stamps));
    setAlwaysOpen(rally.always_open);
    setStartsAt(rally.starts_at ? rally.starts_at.slice(0, 16) : "");
    setEndsAt(rally.ends_at ? rally.ends_at.slice(0, 16) : "");
  }, [selectedId, rallies]);

  useEffect(() => {
    if (mode === "create") {
      setSelectedId("new");
      return;
    }
    if (mode === "edit" && rallyId) {
      setSelectedId(rallyId);
      return;
    }
    if (initialRallyId && rallies.some((r) => r.id === initialRallyId)) {
      setSelectedId(initialRallyId);
    }
  }, [mode, rallyId, initialRallyId, rallies]);

  const maxWeighted = useMemo(() => {
    return computeWeightedRequired(stampPoints);
  }, [stampPoints]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["stamp-rallies", eventId] });
  }

  async function submit(status: "DRAFT" | "ACTIVE") {
    if (!name.trim() || !prize.trim()) {
      toast.error("请填写路线名称和兑换奖品");
      return;
    }
    if (stampPoints.length === 0) {
      toast.error("请至少添加一个打卡点");
      return;
    }

    const invalidCustom = stampPoints.find(
      (p) =>
        !isBoothStampPoint(p) &&
        !(p.custom_name?.trim() || p.name?.trim()),
    );
    if (invalidCustom) {
      toast.error("自定义打卡点名称必填");
      return;
    }
    if (requiredCount < 1 || requiredCount > maxWeighted) {
      toast.error(`目标章数应在 1 – ${maxWeighted} 之间（含权重）`);
      return;
    }
    if (!alwaysOpen && (!startsAt || !endsAt)) {
      toast.error("指定时段时请填写开始与结束时间");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      cover_image: coverImage,
      prize: prize.trim(),
      prize_image_url: prizeImageUrl,
      prize_desc: prizeDesc.trim() || null,
      prize_quantity:
        prizeQuantity === "" ? null : Number(prizeQuantity),
      required_count: requiredCount,
      booth_ids: extractBoothIdsFromStampPoints(stampPoints),
      booth_stamps: stampPoints,
      always_open: alwaysOpen,
      starts_at: alwaysOpen
        ? null
        : startsAt
          ? new Date(startsAt).toISOString()
          : null,
      ends_at: alwaysOpen
        ? null
        : endsAt
          ? new Date(endsAt).toISOString()
          : null,
      status,
    };

    setSaving(true);
    if (status === "DRAFT") setSavingDraft(true);
    try {
      const url =
        selectedId === "new"
          ? `/api/events/${eventId}/stamp-rallies`
          : `/api/events/${eventId}/stamp-rallies/${selectedId}`;
      const res = await fetch(url, {
        method: selectedId === "new" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");

      toast.success(
        status === "ACTIVE" ? "集章路线已发布" : "草稿已保存",
      );

      if (selectedId === "new" && json.data?.id) {
        if (mode === "create") {
          router.push(`/events/${eventId}/stamp-rally/${json.data.id}/edit`);
        } else {
          setSelectedId(json.data.id);
        }
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
      setSavingDraft(false);
    }
  }

  const showDraftPublish =
    !editingRally || editingRally.status === "DRAFT";
  const showActiveSave = editingRally?.status === "ACTIVE";

  return (
    <AdminPage>
      <AdminHeader
        title="集章路线配置"
        description={eventName}
        breadcrumb={["互动管理", "集章打卡"]}
        actions={
          <Link
            href={listHref}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="mr-1.5 size-4" />
            返回列表
          </Link>
        }
      />

      <AdminContent className="p-0">
        {ralliesLoading ? (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        ) : (
          <InteractionEditLayout
            editor={
              <>
                {editingRally && (
                  <div className="mb-6 flex flex-wrap items-center gap-2">
                    <Badge
                      className={cn(
                        "font-normal",
                        STATUS_LABEL[editingRally.status]?.className,
                      )}
                    >
                      {STATUS_LABEL[editingRally.status]?.label}
                    </Badge>
                    {editingRally.status === "ACTIVE" && (
                      <>
                        <Link
                          href={`/events/${eventId}/stamp-rally/${editingRally.id}/progress`}
                          className="inline-flex h-8 items-center rounded-lg border border-border-light px-3 text-sm hover:bg-gray-50"
                        >
                          集章进度
                        </Link>
                        <Link
                          href={`/events/${eventId}/stamp-rally/${editingRally.id}/results`}
                          className="inline-flex h-8 items-center rounded-lg border border-border-light px-3 text-sm hover:bg-gray-50"
                        >
                          查看结果
                        </Link>
                      </>
                    )}
                  </div>
                )}

                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="2025 展会集章之旅"
                  className={creationStyles.titleInput}
                />
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="向参会者介绍集章玩法…"
                  className={cn(creationStyles.descriptionInput, "mt-2")}
                  rows={2}
                />

                <CreationSection hint="封面图">
                  <PrizeImageDropzone
                    imageUrl={coverImage}
                    label="拖拽上传路线封面"
                    onUpload={setCoverImage}
                  />
                </CreationSection>

                <CreationSection
                  hint="兑换奖品"
                  description="集满章数后可兑换的奖励"
                >
                  <input
                    type="text"
                    value={prize}
                    onChange={(e) => setPrize(e.target.value)}
                    placeholder="AirPods Pro"
                    className={cn(
                      creationStyles.titleInput,
                      "min-h-[44px] text-2xl",
                    )}
                  />
                  <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(140px,200px)_1fr]">
                    <PrizeImageDropzone
                      imageUrl={prizeImageUrl}
                      label="拖拽上传奖品图"
                      onUpload={setPrizeImageUrl}
                    />
                    <div className="space-y-5">
                      <Textarea
                        value={prizeDesc}
                        onChange={(e) => setPrizeDesc(e.target.value)}
                        rows={3}
                        placeholder="兑换规则、领取地点等"
                        className="min-h-[80px] resize-none rounded-xl border border-border-light px-4 py-3 text-base"
                      />
                      <div className="space-y-1.5">
                        <p className="text-xs text-text-muted">奖品数量（留空不限）</p>
                        {prizeQuantity === "" ? (
                          <button
                            type="button"
                            onClick={() => setPrizeQuantity(50)}
                            className="text-sm text-brand-blue hover:underline"
                          >
                            + 设置数量上限
                          </button>
                        ) : (
                          <div className="flex items-center gap-3">
                            <CreationNumberStepper
                              value={Number(prizeQuantity)}
                              min={1}
                              onChange={setPrizeQuantity}
                            />
                            <button
                              type="button"
                              onClick={() => setPrizeQuantity("")}
                              className="text-xs text-text-muted hover:text-text-primary"
                            >
                              不限
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CreationSection>

                <CreationSection
                  hint="目标章数"
                  description={`含权重后最多 ${maxWeighted || "?"} 章`}
                >
                  <CreationNumberStepper
                    value={requiredCount}
                    min={1}
                    max={maxWeighted || undefined}
                    onChange={setRequiredCount}
                  />
                </CreationSection>

                <CreationSection
                  hint="打卡点"
                  description="可从展位选择，或添加自定义打卡点，两种方式可混用"
                >
                  <StampPointTable
                    booths={booths}
                    stamps={stampPoints}
                    onChange={setStampPoints}
                    disabled={isLocked}
                  />
                </CreationSection>

                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setScheduleOpen((v) => !v)}
                    className="flex items-center gap-1 text-sm text-text-muted"
                  >
                    更多设置
                    <span
                      className={cn(
                        "transition-transform",
                        scheduleOpen && "rotate-180",
                      )}
                    >
                      ▾
                    </span>
                  </button>
                  {scheduleOpen && (
                    <div className="mt-3 space-y-4 rounded-xl border border-border-light bg-content-bg/30 p-5">
                      <div className="flex items-center justify-between rounded-lg border border-border-light px-4 py-3">
                        <div>
                          <p className="text-sm font-medium">活动期间全程开放</p>
                          <p className="text-xs text-text-muted">
                            关闭后可指定开始与结束时间
                          </p>
                        </div>
                        <Switch
                          checked={alwaysOpen}
                          onCheckedChange={setAlwaysOpen}
                          disabled={isLocked}
                        />
                      </div>
                      {!alwaysOpen && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <p className="text-xs text-text-muted">开始时间</p>
                            <Input
                              type="datetime-local"
                              value={startsAt}
                              onChange={(e) => setStartsAt(e.target.value)}
                              disabled={isLocked}
                              className="h-11"
                            />
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-text-muted">结束时间</p>
                            <Input
                              type="datetime-local"
                              value={endsAt}
                              onChange={(e) => setEndsAt(e.target.value)}
                              disabled={isLocked}
                              className="h-11"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {editingRally?.status === "ACTIVE" && (
                  <CreationSection hint="实时统计">
                    <StampRallyStats
                      eventId={eventId}
                      rallyId={editingRally.id}
                      rallyName={editingRally.name}
                      isActive
                    />
                  </CreationSection>
                )}
              </>
            }
            preview={
              <StampPassportPreview
                name={name}
                coverImage={coverImage}
                description={description}
                prize={prize}
                prizeImageUrl={prizeImageUrl}
                requiredCount={requiredCount}
                stamps={stampPoints}
              />
            }
            footer={
              showDraftPublish ? (
                <LotteryCreationFooter
                  saving={saving && !savingDraft}
                  savingDraft={savingDraft}
                  onSaveDraft={() => void submit("DRAFT")}
                  onPublish={() => void submit("ACTIVE")}
                  publishLabel="发布"
                />
              ) : showActiveSave ? (
                <LotteryCreationFooter
                  hideDraft
                  saving={saving}
                  onSaveDraft={() => undefined}
                  onPublish={() => void submit("ACTIVE")}
                  publishLabel="保存变更"
                />
              ) : undefined
            }
          />
        )}

        {!ralliesLoading && rallies.length === 0 && selectedId === "new" && (
          <p className="px-8 py-4 text-center text-sm text-text-muted">
            配置完成后点击「发布」，status 将设为 ACTIVE
          </p>
        )}
      </AdminContent>
    </AdminPage>
  );
}
