"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Trophy, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  BoothStampTable,
  type BoothOption,
} from "@/components/stamp/BoothStampTable";
import { StampRallyStats } from "@/components/stamp/StampRallyStats";
import type { BoothStampConfig } from "@/lib/stamp/stamp-rally-config";
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
  stamps: BoothStampConfig[];
}) {
  const collected = Math.min(2, stamps.length);

  return (
    <div className="mx-auto w-full max-w-[320px] overflow-hidden rounded-2xl border border-border-light bg-gradient-to-b from-brand-blue-light/40 to-white shadow-lg">
      {coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImage}
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
          {prizeImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={prizeImageUrl}
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
              添加展位章后在此预览
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
                  key={stamp.booth_id}
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
  initialRallyId?: string | null;
};

export function StampRallyConfigurator({
  eventId,
  eventName,
  initialRallyId,
}: StampRallyConfiguratorProps) {
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | "new">(
    initialRallyId ?? "new",
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [prize, setPrize] = useState("");
  const [prizeImageUrl, setPrizeImageUrl] = useState<string | null>(null);
  const [prizeDesc, setPrizeDesc] = useState("");
  const [prizeQuantity, setPrizeQuantity] = useState<number | "">("");
  const [requiredCount, setRequiredCount] = useState(3);
  const [boothStamps, setBoothStamps] = useState<BoothStampConfig[]>([]);
  const [alwaysOpen, setAlwaysOpen] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<
    "cover" | "prize" | null
  >(null);

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
      setBoothStamps([]);
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
    setBoothStamps(rally.booth_stamps);
    setAlwaysOpen(rally.always_open);
    setStartsAt(rally.starts_at ? rally.starts_at.slice(0, 16) : "");
    setEndsAt(rally.ends_at ? rally.ends_at.slice(0, 16) : "");
  }, [selectedId, rallies]);

  useEffect(() => {
    if (initialRallyId && rallies.some((r) => r.id === initialRallyId)) {
      setSelectedId(initialRallyId);
    }
  }, [initialRallyId, rallies]);

  const maxWeighted = useMemo(() => {
    return boothStamps.reduce((sum, s) => sum + s.weight, 0);
  }, [boothStamps]);

  async function handleUpload(
    file: File,
    target: "cover" | "prize",
  ) {
    setUploading(target);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "上传失败");
      const url = json.data?.url ?? json.url;
      if (target === "cover") setCoverImage(url);
      else setPrizeImageUrl(url);
      toast.success("图片上传成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(null);
    }
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["stamp-rallies", eventId] });
  }

  async function submit(status: "DRAFT" | "ACTIVE") {
    if (!name.trim() || !prize.trim()) {
      toast.error("请填写路线名称和兑换奖品");
      return;
    }
    if (boothStamps.length === 0) {
      toast.error("请至少添加一个展位章");
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
      booth_ids: boothStamps.map((s) => s.booth_id),
      booth_stamps: boothStamps,
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
        setSelectedId(json.data.id);
      }
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function UploadButton({
    target,
    label,
  }: {
    target: "cover" | "prize";
    label: string;
  }) {
    return (
      <label className="cursor-pointer">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload(file, target);
          }}
        />
        <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-light px-3 text-sm text-brand-blue hover:bg-brand-blue-light">
          {uploading === target ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {label}
        </span>
      </label>
    );
  }

  return (
    <AdminPage>
      <AdminHeader
        title="集章路线配置"
        description={eventName}
        breadcrumb={["互动管理", "集章打卡"]}
        actions={
          <div className="flex items-center gap-2">
            {rallies.length > 0 && (
              <select
                className="h-9 rounded-lg border border-border-light bg-white px-3 text-sm"
                value={selectedId}
                onChange={(e) =>
                  setSelectedId(
                    e.target.value === "new" ? "new" : e.target.value,
                  )
                }
              >
                <option value="new">+ 新建路线</option>
                {rallies.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedId("new")}
            >
              新建
            </Button>
          </div>
        }
      />

      <AdminContent>
        {ralliesLoading ? (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              {editingRally && (
                <div className="flex flex-wrap items-center gap-2">
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

              <SectionCard title="基础设置" description="路线名称、封面与兑换奖品">
                <div className="space-y-4 p-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>路线名称</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="2025 展会集章之旅"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        目标章数（1 – {maxWeighted || "?"})
                      </Label>
                      <Input
                        type="number"
                        min={1}
                        max={maxWeighted || undefined}
                        value={requiredCount}
                        onChange={(e) =>
                          setRequiredCount(Number(e.target.value))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>路线描述</Label>
                    <Textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="向参会者介绍集章玩法…"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>封面图</Label>
                    <div className="flex items-center gap-3">
                      {coverImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={coverImage}
                          alt=""
                          className="size-16 rounded-lg border object-cover"
                        />
                      )}
                      <UploadButton target="cover" label="上传封面" />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>兑换奖品名称</Label>
                      <Input
                        value={prize}
                        onChange={(e) => setPrize(e.target.value)}
                        placeholder="AirPods Pro"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>奖品数量</Label>
                      <Input
                        type="number"
                        min={1}
                        value={prizeQuantity}
                        onChange={(e) =>
                          setPrizeQuantity(
                            e.target.value === ""
                              ? ""
                              : Number(e.target.value),
                          )
                        }
                        placeholder="不限留空"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>奖品描述</Label>
                    <Textarea
                      value={prizeDesc}
                      onChange={(e) => setPrizeDesc(e.target.value)}
                      rows={2}
                      placeholder="兑换规则、领取地点等"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>奖品图片</Label>
                    <div className="flex items-center gap-3">
                      {prizeImageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prizeImageUrl}
                          alt=""
                          className="size-16 rounded-lg border object-cover"
                        />
                      )}
                      <UploadButton target="prize" label="上传奖品图" />
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard
                title="展位章设置"
                description="选择参与展位，配置章名称、图案、权重与是否必须集"
              >
                <div className="p-5">
                  <BoothStampTable
                    booths={booths}
                    stamps={boothStamps}
                    onChange={setBoothStamps}
                    disabled={isLocked}
                  />
                </div>
              </SectionCard>

              <SectionCard title="上线设置" description="开放时段与发布状态">
                <div className="space-y-4 p-5">
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
                        <Label>开始时间</Label>
                        <Input
                          type="datetime-local"
                          value={startsAt}
                          onChange={(e) => setStartsAt(e.target.value)}
                          disabled={isLocked}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>结束时间</Label>
                        <Input
                          type="datetime-local"
                          value={endsAt}
                          onChange={(e) => setEndsAt(e.target.value)}
                          disabled={isLocked}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    {(!editingRally || editingRally.status === "DRAFT") && (
                      <>
                        <Button
                          variant="outline"
                          disabled={saving}
                          onClick={() => void submit("DRAFT")}
                        >
                          保存草稿
                        </Button>
                        <Button
                          className="bg-brand-blue text-white hover:bg-brand-blue/90"
                          disabled={saving}
                          onClick={() => void submit("ACTIVE")}
                        >
                          {saving ? "发布中…" : "发布"}
                        </Button>
                      </>
                    )}
                    {editingRally?.status === "ACTIVE" && (
                      <Button
                        variant="outline"
                        disabled={saving}
                        onClick={() => void submit("ACTIVE")}
                      >
                        保存变更
                      </Button>
                    )}
                  </div>
                </div>
              </SectionCard>

              {editingRally?.status === "ACTIVE" && (
                <StampRallyStats
                  eventId={eventId}
                  rallyId={editingRally.id}
                  rallyName={editingRally.name}
                  isActive
                />
              )}
            </div>

            <div className="xl:sticky xl:top-4 xl:self-start">
              <SectionCard
                title="参会者预览"
                description="实时预览集章地图效果"
              >
                <div className="p-5">
                  <StampPassportPreview
                    name={name}
                    coverImage={coverImage}
                    description={description}
                    prize={prize}
                    prizeImageUrl={prizeImageUrl}
                    requiredCount={requiredCount}
                    stamps={boothStamps}
                  />
                </div>
              </SectionCard>
            </div>
          </div>
        )}

        {!ralliesLoading && rallies.length === 0 && selectedId === "new" && (
          <p className="mt-4 text-center text-sm text-text-muted">
            配置完成后点击「发布」，status 将设为 ACTIVE
          </p>
        )}
      </AdminContent>
    </AdminPage>
  );
}
