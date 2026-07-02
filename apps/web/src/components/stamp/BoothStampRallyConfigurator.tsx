"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
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
import type {
  BoothCheckpointDto,
  BoothStampRallyDto,
} from "@/lib/stamp/booth-stamp-rally-schemas";
import {
  BOOTH_CHECKPOINT_EMOJIS,
  DEFAULT_CHECKPOINT_NAMES,
} from "@/lib/stamp/booth-stamp-rally-schemas";
import { cn } from "@/lib/utils";

type CheckpointDraft = {
  id?: string;
  name: string;
  icon: string | null;
};

async function fetchRallies(boothId: string) {
  const res = await fetch(`/api/booths/${boothId}/stamp-rallies`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.rallies as BoothStampRallyDto[];
}

function defaultCheckpoints(): CheckpointDraft[] {
  return DEFAULT_CHECKPOINT_NAMES.map((name) => ({
    name,
    icon: "📍",
  }));
}

async function downloadAllQrs(
  rallyName: string,
  checkpoints: BoothCheckpointDto[],
) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  for (const cp of checkpoints) {
    const res = await fetch(cp.qr_url);
    const blob = await res.blob();
    const safeName = cp.name.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
    zip.file(`${safeName}-${cp.scan_code.slice(-6)}.png`, blob);
  }

  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${rallyName}-打卡二维码.zip`;
  link.click();
  URL.revokeObjectURL(url);
}

export type BoothStampRallyConfiguratorProps = {
  eventId: string;
  boothId: string;
  boothCode: string;
  boothName: string;
  companyName: string;
};

export function BoothStampRallyConfigurator({
  eventId,
  boothId,
  boothCode,
  boothName,
  companyName,
}: BoothStampRallyConfiguratorProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(`${boothCode} 展位集章`);
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [prizeImageUrl, setPrizeImageUrl] = useState<string | null>(null);
  const [prizeDesc, setPrizeDesc] = useState("");
  const [requireAll, setRequireAll] = useState(true);
  const [requiredCount, setRequiredCount] = useState(3);
  const [checkpoints, setCheckpoints] = useState<CheckpointDraft[]>(
    defaultCheckpoints(),
  );
  const [rallyId, setRallyId] = useState<string | undefined>();
  const [savedRally, setSavedRally] = useState<BoothStampRallyDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPrize, setUploadingPrize] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);

  const { data: rallies = [], isLoading } = useQuery({
    queryKey: ["booth-stamp-rallies", boothId],
    queryFn: () => fetchRallies(boothId),
  });

  const activeRally = rallies[0] ?? null;

  useEffect(() => {
    if (!activeRally) return;
    setRallyId(activeRally.id);
    setSavedRally(activeRally);
    setName(activeRally.name);
    setDescription(activeRally.description ?? "");
    setPrize(activeRally.prize);
    setPrizeImageUrl(activeRally.prize_image_url);
    setPrizeDesc(activeRally.prize_desc ?? "");
    setRequireAll(activeRally.require_all);
    setRequiredCount(activeRally.required_count);
    setCheckpoints(
      activeRally.checkpoints.map((cp) => ({
        id: cp.id,
        name: cp.name,
        icon: cp.icon,
      })),
    );
  }, [activeRally]);

  const maxRequired = checkpoints.length;

  const previewCheckpoints = savedRally?.checkpoints ?? [];

  async function handlePrizeUpload(file: File) {
    setUploadingPrize(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "上传失败");
      setPrizeImageUrl(json.data?.url ?? json.url);
      toast.success("奖品图片上传成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingPrize(false);
    }
  }

  function updateCheckpoint(index: number, patch: Partial<CheckpointDraft>) {
    setCheckpoints((prev) =>
      prev.map((cp, i) => (i === index ? { ...cp, ...patch } : cp)),
    );
  }

  function addCheckpoint() {
    setCheckpoints((prev) => [
      ...prev,
      { name: `打卡点 ${prev.length + 1}`, icon: "📍" },
    ]);
  }

  function removeCheckpoint(index: number) {
    if (checkpoints.length <= 1) {
      toast.error("至少保留一个打卡点");
      return;
    }
    setCheckpoints((prev) => prev.filter((_, i) => i !== index));
  }

  async function submit(publish: boolean) {
    if (!name.trim() || !prize.trim()) {
      toast.error("请填写活动名称和兑换奖品");
      return;
    }
    if (checkpoints.some((cp) => !cp.name.trim())) {
      toast.error("请填写所有打卡点名称");
      return;
    }
    if (!requireAll && (requiredCount < 1 || requiredCount > maxRequired)) {
      toast.error(`集满数量应在 1 – ${maxRequired} 之间`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/booths/${boothId}/stamp-rallies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rallyId,
          name,
          description: description || null,
          prize,
          prize_image_url: prizeImageUrl,
          prize_desc: prizeDesc || null,
          checkpoints,
          require_all: requireAll,
          required_count: requireAll ? maxRequired : requiredCount,
          publish,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");

      const rally = json.data as BoothStampRallyDto;
      setRallyId(rally.id);
      setSavedRally(rally);
      toast.success(publish ? "展位集章已发布，二维码已生成" : "草稿已保存");
      void queryClient.invalidateQueries({
        queryKey: ["booth-stamp-rallies", boothId],
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadZip() {
    if (!savedRally?.checkpoints.length) {
      toast.error("请先保存并生成二维码");
      return;
    }
    setDownloadingZip(true);
    try {
      await downloadAllQrs(savedRally.name, savedRally.checkpoints);
      toast.success("ZIP 下载已开始");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "打包失败");
    } finally {
      setDownloadingZip(false);
    }
  }

  const statusBadge = useMemo(() => {
    if (!savedRally) return null;
    if (savedRally.status === "ACTIVE") {
      return (
        <Badge className="bg-brand-green-light font-normal text-brand-green">
          进行中
        </Badge>
      );
    }
    if (savedRally.status === "ENDED") {
      return (
        <Badge className="bg-gray-100 font-normal text-text-muted">
          已结束
        </Badge>
      );
    }
    return (
      <Badge className="bg-brand-amber-light font-normal text-brand-amber">
        草稿
      </Badge>
    );
  }, [savedRally]);

  return (
    <AdminPage>
      <AdminHeader
        title="展位打卡点集章"
        description={`${boothCode} · ${companyName || boothName}`}
        breadcrumb={["展位管理", "集章打卡"]}
      />

      <AdminContent>
        {isLoading ? (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
            <div className="space-y-6">
              {savedRally && (
                <div className="flex flex-wrap items-center gap-3">
                  {statusBadge}
                  <span className="text-sm text-text-muted">
                    参与 {savedRally.participant_count} 人 · 完成{" "}
                    {savedRally.completed_count} 人
                  </span>
                </div>
              )}

              <SectionCard
                title="打卡点列表"
                description="配置展位内各区域的独立打卡章"
              >
                <div className="space-y-3 p-5">
                  {checkpoints.map((cp, index) => (
                    <div
                      key={cp.id ?? `draft-${index}`}
                      className="flex flex-wrap items-start gap-3 rounded-lg border border-border-light p-3"
                    >
                      <div className="flex flex-wrap gap-1">
                        {BOOTH_CHECKPOINT_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            className={cn(
                              "flex size-8 items-center justify-center rounded-md text-lg",
                              cp.icon === emoji
                                ? "bg-brand-blue-light ring-1 ring-brand-blue"
                                : "hover:bg-gray-100",
                            )}
                            onClick={() =>
                              updateCheckpoint(index, { icon: emoji })
                            }
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                      <Input
                        className="min-w-[200px] flex-1"
                        value={cp.name}
                        onChange={(e) =>
                          updateCheckpoint(index, { name: e.target.value })
                        }
                        placeholder="打卡点名称"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-text-muted hover:text-red-600"
                        onClick={() => removeCheckpoint(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addCheckpoint}
                  >
                    <Plus className="mr-1 size-4" />
                    添加打卡点
                  </Button>
                </div>
              </SectionCard>

              <SectionCard title="集满设置" description="完成条件与兑换奖品">
                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between rounded-lg border border-border-light px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">集满全部打卡点</p>
                      <p className="text-xs text-text-muted">
                        关闭后可指定完成数量（如 3 选 2）
                      </p>
                    </div>
                    <Switch
                      checked={requireAll}
                      onCheckedChange={(checked) => {
                        setRequireAll(checked);
                        if (checked) setRequiredCount(maxRequired);
                      }}
                    />
                  </div>

                  {!requireAll && (
                    <div className="space-y-2">
                      <Label>集满数量（1 – {maxRequired}）</Label>
                      <Input
                        type="number"
                        min={1}
                        max={maxRequired}
                        value={requiredCount}
                        onChange={(e) =>
                          setRequiredCount(Number(e.target.value))
                        }
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>活动名称</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>兑换奖品</Label>
                    <Input
                      value={prize}
                      onChange={(e) => setPrize(e.target.value)}
                      placeholder="建议设置比展位抽奖更高价值的奖品"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>奖品说明</Label>
                    <Textarea
                      value={prizeDesc}
                      onChange={(e) => setPrizeDesc(e.target.value)}
                      rows={2}
                      placeholder="兑换方式、领取地点"
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
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handlePrizeUpload(file);
                          }}
                        />
                        <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-light px-3 text-sm text-brand-blue hover:bg-brand-blue-light">
                          {uploadingPrize ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Upload className="size-4" />
                          )}
                          上传图片
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
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
                      {saving ? "生成中…" : "生成二维码并发布"}
                    </Button>
                  </div>
                </div>
              </SectionCard>

              {previewCheckpoints.length > 0 && (
                <SectionCard
                  title="二维码管理"
                  description="每个打卡点独立二维码，打印后贴至对应区域"
                  action={
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={downloadingZip}
                      onClick={() => void handleDownloadZip()}
                    >
                      {downloadingZip ? (
                        <Loader2 className="mr-1 size-4 animate-spin" />
                      ) : (
                        <Download className="mr-1 size-4" />
                      )}
                      全部下载 ZIP
                    </Button>
                  }
                >
                  <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
                    {previewCheckpoints.map((cp) => (
                      <div
                        key={cp.id}
                        className="rounded-xl border border-border-light bg-white p-4 text-center"
                      >
                        <p className="font-medium">{cp.name}</p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          已打卡 {cp.collect_count} 次
                        </p>
                        <div className="mt-3 flex justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={cp.qr_url}
                            alt={`${cp.name} 二维码`}
                            className="size-[140px] rounded-lg bg-white object-contain"
                          />
                        </div>
                        <p className="mt-2 truncate font-mono text-[10px] text-text-muted">
                          {cp.scan_code.slice(-8)}
                        </p>
                        <a
                          href={cp.qr_url}
                          download={`${cp.name}-二维码.png`}
                          className="mt-2 inline-flex h-8 items-center rounded-lg border border-border-light px-3 text-xs hover:bg-gray-50"
                        >
                          <Download className="mr-1 size-3" />
                          下载
                        </a>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>

            <div className="xl:sticky xl:top-4 xl:self-start">
              <SectionCard title="预览" description="参会者需走遍各打卡区域">
                <div className="p-5">
                  <div className="rounded-2xl border border-border-light bg-gradient-to-b from-brand-gold/10 to-white p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="size-5 text-brand-blue" />
                      <p className="font-semibold">{boothCode} 展位</p>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      {requireAll
                        ? `集满 ${maxRequired} 个区域即可兑换`
                        : `集满 ${requireAll ? maxRequired : requiredCount} / ${maxRequired} 个区域即可兑换`}
                    </p>
                    <p className="mt-2 text-sm font-medium text-brand-gold">
                      🎁 {prize || "填写兑换奖品"}
                    </p>
                    <div className="mt-4 space-y-2">
                      {checkpoints.map((cp, i) => (
                        <div
                          key={cp.id ?? i}
                          className="flex items-center gap-2 rounded-lg border border-border-light bg-white/80 px-3 py-2"
                        >
                          <span className="text-xl">{cp.icon ?? "📍"}</span>
                          <span className="text-sm">{cp.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-center text-xs text-text-muted">
                    活动 ID: {eventId.slice(-6)}
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
