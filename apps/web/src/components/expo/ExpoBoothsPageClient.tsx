"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Map as MapIcon,
  Monitor,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { toastInviteSendError } from "@/lib/invite/invite-credit-toast";
import { EXPERIENCE_BULK_INVITE_MESSAGE } from "@/lib/experience/experience-invite-messages";
import { withPublicPath } from "@/lib/public-path";
import { useExperienceAccount } from "@/hooks/useExperienceAccount";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExhibitorReviewsPanel } from "@/components/expo/ExhibitorReviewsPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableShell,
  TableToolbar,
} from "@/components/ui/table";
import { StatusChip, type StatusChipVariant } from "@/components/ui/status-chip";
import { useEventFeatureFlags } from "@/hooks/useEventFeatureFlags";
import { isFeatureFlagEnabled } from "@/lib/event-feature-flags";
import type { BoothRankingItem } from "@/lib/booth-rankings-service";
import {
  DEFAULT_EXPO_BOOTH_TYPES,
  parseExpoBoothTypes,
  type ExpoBoothType,
  type ExpoSettingsPayload,
} from "@/lib/expo-settings-shared";

type SortMode = "code" | "popularity";

type BoothRow = {
  id: string;
  code: string;
  name: string;
  status: "AVAILABLE" | "BOOKED" | "OCCUPIED";
  exhibitor: { id: string; name: string };
  hallLabel: string | null;
  maxStaffCount: number;
  extraStaffPurchased: number;
  staffQuota: {
    currentCount: number;
    maxCount: number;
    remainingSlots: number;
    isFull: boolean;
  };
  _count: { leads: number };
  stats: { todayVisitors: number; gradeA: number; crmSynced: number };
};

type BoothMapData = {
  booths: BoothRow[];
  exhibitors: Array<{ id: string; name: string }>;
};

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "空闲" },
  { value: "BOOKED", label: "已预订" },
  { value: "OCCUPIED", label: "已入驻" },
] as const;

async function fetchRankings(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/booth-rankings`);
  if (!res.ok) return { rankings: [] as BoothRankingItem[] };
  const json = (await res.json()) as { data?: { rankings?: BoothRankingItem[] } };
  return { rankings: json.data?.rankings ?? [] };
}

function HeatChangeBadge({ change }: { change: number }) {
  if (change === 0) return <span className="text-text-muted">—</span>;
  const up = change > 0;
  return (
    <span className={up ? "text-brand-green" : "text-brand-red"}>
      {up ? "↑" : "↓"}
      {Math.abs(change)}
    </span>
  );
}
async function fetchBooths(eventId: string): Promise<BoothMapData> {
  const res = await fetch(withPublicPath(`/api/events/${eventId}/booths`));
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as BoothMapData;
}

async function fetchExpoBoothTypes(eventId: string): Promise<ExpoBoothType[]> {
  const res = await fetch(
    withPublicPath(`/api/events/${eventId}/expo-settings`),
  );
  if (!res.ok) return DEFAULT_EXPO_BOOTH_TYPES.map((t) => ({ ...t }));
  const json = (await res.json()) as { data?: ExpoSettingsPayload };
  return parseExpoBoothTypes(json.data?.settings?.expo_booth_types).types;
}

type BoothForm = {
  code: string;
  name: string;
  exhibitorId: string;
  status: BoothRow["status"];
  maxStaffCount: number;
  hallLabel: string;
};

const emptyForm: BoothForm = {
  code: "",
  name: "",
  exhibitorId: "",
  status: "AVAILABLE",
  maxStaffCount: 2,
  hallLabel: "",
};

function boothStatusVariant(status: BoothRow["status"]): StatusChipVariant {
  switch (status) {
    case "AVAILABLE":
      return "neutral";
    case "BOOKED":
      return "warning";
    case "OCCUPIED":
      return "success";
  }
}

function boothStatusLabel(status: BoothRow["status"]) {
  return STATUS_OPTIONS.find((opt) => opt.value === status)?.label ?? status;
}

function staffQuotaLabel(booth: BoothRow): string {
  const { currentCount, maxCount, isFull } = booth.staffQuota;
  if (isFull) return `${currentCount}/${maxCount} 已满`;
  return `${currentCount}/${maxCount}`;
}

export function ExpoBoothsPageClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const { data: featureFlags } = useEventFeatureFlags(eventId);
  const { data: experienceProfile } = useExperienceAccount();
  const experienceBulkBlocked = Boolean(experienceProfile?.isActiveExperience);
  const showRanking = isFeatureFlagEnabled(featureFlags, "boothRanking");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchHallLabel, setBatchHallLabel] = useState("");
  const [batchMaxStaff, setBatchMaxStaff] = useState(2);
  const [editing, setEditing] = useState<BoothRow | null>(null);
  const [form, setForm] = useState<BoothForm>(emptyForm);
  const [inviteAllBusy, setInviteAllBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortMode>(
    searchParams.get("sort") === "popularity" ? "popularity" : "code",
  );

  useEffect(() => {
    if (showRanking && searchParams.get("sort") === "popularity") {
      setSortBy("popularity");
    }
  }, [showRanking, searchParams]);

  const { data, isLoading } = useQuery({
    queryKey: ["expo-booths", eventId],
    queryFn: () => fetchBooths(eventId),
  });

  const { data: boothTypeCatalog = DEFAULT_EXPO_BOOTH_TYPES } = useQuery({
    queryKey: ["expo-settings", eventId, "booth-types"],
    queryFn: () => fetchExpoBoothTypes(eventId),
    staleTime: 60_000,
  });

  const {
    data: rankingData,
    isFetching: rankingsFetching,
    refetch: refetchRankings,
  } = useQuery({
    queryKey: ["booth-rankings", eventId],
    queryFn: () => fetchRankings(eventId),
    refetchInterval: 60_000,
    enabled: showRanking,
  });

  const booths = data?.booths ?? [];
  const exhibitors = data?.exhibitors ?? [];

  const rankingMap = useMemo(
    () => new Map((rankingData?.rankings ?? []).map((row) => [row.booth_id, row])),
    [rankingData?.rankings],
  );

  const filtered = useMemo(() => {
    if (statusFilter === "all") return booths;
    return booths.filter((b) => b.status === statusFilter);
  }, [booths, statusFilter]);

  const visibleBooths = useMemo(() => {
    if (!showRanking || sortBy === "code") return filtered;
    return [...filtered].sort((a, b) => {
      const rankA = rankingMap.get(a.id)?.rank ?? 9999;
      const rankB = rankingMap.get(b.id)?.rank ?? 9999;
      return rankA - rankB;
    });
  }, [filtered, sortBy, rankingMap, showRanking]);

  const exhibitorOptions = useMemo(() => {
    if (!editing) return exhibitors;
    if (exhibitors.some((ex) => ex.id === editing.exhibitor.id)) return exhibitors;
    return [
      { id: editing.exhibitor.id, name: editing.exhibitor.name },
      ...exhibitors,
    ];
  }, [exhibitors, editing]);

  const selectedExhibitorName =
    exhibitorOptions.find((ex) => ex.id === form.exhibitorId)?.name ?? "";

  const catalogNames = useMemo(
    () => new Set(boothTypeCatalog.map((t) => t.name)),
    [boothTypeCatalog],
  );

  const orphanHallLabel =
    form.hallLabel && !catalogNames.has(form.hallLabel)
      ? form.hallLabel
      : null;

  const hallLabelOptions = useMemo(
    () => boothTypeCatalog.map((t) => t.name),
    [boothTypeCatalog],
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.hallLabel.trim()) {
        throw new Error("请选择展位类型");
      }
      if (!catalogNames.has(form.hallLabel.trim())) {
        throw new Error("请选择展会配置中的展位类型");
      }
      const payload = {
        code: form.code,
        name: form.name,
        exhibitorId: form.exhibitorId || undefined,
        status: form.status,
        maxStaffCount: form.maxStaffCount,
        hallLabel: form.hallLabel.trim(),
      };
      if (editing) {
        const res = await fetch(
          withPublicPath(`/api/events/${eventId}/booths/${editing.id}`),
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? json.message ?? "保存失败");
        }
        return;
      }

      const res = await fetch(withPublicPath(`/api/events/${eventId}/booths`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? json.message ?? "创建失败");
      }
    },
    onSuccess: () => {
      toast.success(editing ? "已更新展位" : "已创建展位");
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      void queryClient.invalidateQueries({ queryKey: ["expo-booths", eventId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "操作失败"),
  });

  const batchMutation = useMutation({
    mutationFn: async () => {
      const hallLabel = batchHallLabel.trim();
      if (!hallLabel) throw new Error("请选择展位类型");
      const res = await fetch(withPublicPath(`/api/events/${eventId}/booths`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchMaxStaffCount: { hallLabel, maxStaffCount: batchMaxStaff },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json.error ?? "批量设置失败");
      }
      return json.data as { updated: number };
    },
    onSuccess: (data) => {
      toast.success(`已更新 ${data.updated} 个展位的名额上限`);
      setBatchDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["expo-booths", eventId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "批量设置失败"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (boothId: string) => {
      const res = await fetch(`/api/events/${eventId}/booths/${boothId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
    },
    onSuccess: () => {
      toast.success("已删除展位");
      void queryClient.invalidateQueries({ queryKey: ["expo-booths", eventId] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "删除失败"),
  });

  function openCreate() {
    setEditing(null);
    const firstType = boothTypeCatalog[0];
    setForm({
      ...emptyForm,
      exhibitorId: exhibitors[0]?.id ?? "",
      hallLabel: firstType?.name ?? "",
      maxStaffCount: firstType?.defaultMaxStaffCount ?? 2,
    });
    setDialogOpen(true);
  }

  function openEdit(booth: BoothRow) {
    setEditing(booth);
    setForm({
      code: booth.code,
      name: booth.name,
      exhibitorId: booth.exhibitor.id,
      status: booth.status,
      maxStaffCount: booth.maxStaffCount,
      hallLabel: booth.hallLabel ?? "",
    });
    setDialogOpen(true);
  }

  async function handleInviteAllExhibitors() {
    if (experienceBulkBlocked) {
      toast.error(EXPERIENCE_BULK_INVITE_MESSAGE);
      return;
    }
    const ok = window.confirm(
      "将向本场全部未激活的展商工作人员发送固定模板邀请（优先短信，否则邮件）。确认继续？",
    );
    if (!ok) return;

    setInviteAllBusy(true);
    try {
      const res = await fetch(`/api/events/${eventId}/exhibitors/invite-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "AUTO" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json.error ?? json.message ?? "邀请失败";
        const err = new Error(msg) as Error & { redirectTo?: string };
        if (typeof json.redirect_to === "string") {
          err.redirectTo = json.redirect_to;
        } else if (res.status === 402 || String(msg).includes("余额不足")) {
          err.redirectTo = "/organizer/billing";
        }
        throw err;
      }
      toast.success(
        `已排队 ${json.data?.queued ?? 0} 条邀请（展商 ${json.data?.total_exhibitors ?? 0} 人，跳过 ${json.data?.skipped ?? 0}）`,
      );
    } catch (e) {
      toastInviteSendError(e, "邀请失败");
    } finally {
      setInviteAllBusy(false);
    }
  }

  function openBatchDialog() {
    const first = boothTypeCatalog[0];
    setBatchHallLabel(first?.name ?? "");
    setBatchMaxStaff(first?.defaultMaxStaffCount ?? 2);
    setBatchDialogOpen(true);
  }

  async function quickStatusChange(booth: BoothRow, status: BoothRow["status"]) {
    const res = await fetch(`/api/events/${eventId}/booths/${booth.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      toast.error("状态更新失败");
      return;
    }
    toast.success("状态已更新");
    void queryClient.invalidateQueries({ queryKey: ["expo-booths", eventId] });
  }

  return (
    <AdminPage>
      <AdminHeader
        title="展商列表"
        description={eventName}
        breadcrumb={["展商管理", "展商列表"]}
        actions={
          <div className="flex flex-wrap gap-2">
            {showRanking && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={rankingsFetching}
                  onClick={() => {
                    void refetchRankings();
                    toast.success("热度数据已刷新");
                  }}
                >
                  <RefreshCw
                    className={`mr-1 size-4 ${rankingsFetching ? "animate-spin" : ""}`}
                  />
                  刷新热度
                </Button>
                <a
                  href={withPublicPath(
                    `/events/${eventId}/interactions/bigscreen?tab=booth_ranking`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center rounded-lg bg-brand-purple px-4 text-sm text-white hover:bg-brand-purple/90"
                >
                  <Monitor className="mr-1 size-4" />
                  大屏投放
                </a>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={inviteAllBusy || experienceBulkBlocked}
              title={
                experienceBulkBlocked
                  ? EXPERIENCE_BULK_INVITE_MESSAGE
                  : undefined
              }
              onClick={() => void handleInviteAllExhibitors()}
            >
              <Send className="mr-1 size-4" />
              {inviteAllBusy ? "邀请中…" : "一键邀请展商"}
            </Button>
            <Link
              href={`/events/${eventId}/exhibitors/map`}
              className="inline-flex h-9 items-center rounded-lg border border-border-light px-4 text-sm hover:bg-content"
            >
              <MapIcon className="mr-1 size-4" />
              展位地图
            </Link>
            <Button
              variant="outline"
              onClick={openBatchDialog}
              disabled={hallLabelOptions.length === 0}
              title={
                hallLabelOptions.length === 0
                  ? "请先在「展会配置」中添加展位类型"
                  : undefined
              }
            >
              <Users className="mr-1 size-4" />
              批量设置名额
            </Button>
            <Button
              className="bg-brand-blue text-white"
              onClick={openCreate}
              disabled={exhibitors.length === 0}
            >
              <Plus className="mr-1 size-4" />
              新建展位
            </Button>
          </div>
        }
      />

      <AdminContent>
        <ExhibitorReviewsPanel
          eventId={eventId}
          onChanged={() =>
            void queryClient.invalidateQueries({
              queryKey: ["expo-booths", eventId],
            })
          }
        />

        <SectionCard
          title={`全部展位（${booths.length}）`}
          description={
            showRanking
              ? "管理展位编号、展商分配与入驻状态；浏览量综合扫码与线索，可按人气排序"
              : "管理展位编号、展商分配与入驻状态"
          }
        >
          <div className="space-y-4">
          <TableToolbar>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v ?? "all")}
            >
              <SelectTrigger className="h-9 w-36">
                <SelectValue placeholder="筛选状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showRanking && (
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy((v as SortMode) ?? "code")}
              >
                <SelectTrigger className="h-9 w-36">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="code">按展位号</SelectItem>
                  <SelectItem value="popularity">按人气</SelectItem>
                </SelectContent>
              </Select>
            )}
          </TableToolbar>

          {isLoading ? (
            <p className="py-12 text-center text-sm text-text-secondary">加载中…</p>
          ) : visibleBooths.length === 0 ? (
            <p className="py-12 text-center text-sm text-text-secondary">
              {booths.length === 0
                ? "暂无展位，点击「新建展位」开始配置"
                : "当前筛选条件下无展位"}
            </p>
          ) : (
            <TableShell>
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-surface-secondary">
                    <TableHead>展位号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>展商</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>工作人员名额</TableHead>
                    {showRanking && (
                      <>
                        <TableHead>排名</TableHead>
                        <TableHead>浏览</TableHead>
                        <TableHead>今日浏览</TableHead>
                        <TableHead>30 分钟</TableHead>
                      </>
                    )}
                    {!showRanking && <TableHead>今日访客</TableHead>}
                    <TableHead>线索</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleBooths.map((booth) => {
                    const heat = rankingMap.get(booth.id);
                    return (
                    <TableRow key={booth.id} className="h-12">
                      <TableCell className="font-mono font-medium text-brand-blue">
                        {booth.code}
                      </TableCell>
                      <TableCell>{booth.name}</TableCell>
                      <TableCell>{booth.exhibitor.name}</TableCell>
                      <TableCell>
                        <Select
                          value={booth.status}
                          onValueChange={(v) =>
                            void quickStatusChange(
                              booth,
                              v as BoothRow["status"],
                            )
                          }
                        >
                          <SelectTrigger className="h-auto w-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0">
                            <StatusChip variant={boothStatusVariant(booth.status)}>
                              {boothStatusLabel(booth.status)}
                            </StatusChip>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "text-sm tabular-nums",
                            booth.staffQuota.isFull
                              ? "font-medium text-brand-red"
                              : "text-text-secondary",
                          )}
                        >
                          {staffQuotaLabel(booth)}
                        </span>
                      </TableCell>
                      {showRanking && (
                        <>
                          <TableCell className="tabular-nums">
                            {heat ? (
                              <span
                                className={
                                  heat.rank <= 3
                                    ? "font-bold text-brand-gold"
                                    : "text-text-secondary"
                                }
                              >
                                #{heat.rank}
                              </span>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {heat?.total_visitors ?? 0}
                          </TableCell>
                          <TableCell className="tabular-nums font-medium">
                            {heat?.today_visitors ?? booth.stats.todayVisitors}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {heat ? (
                              <HeatChangeBadge change={heat.change} />
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </TableCell>
                        </>
                      )}
                      {!showRanking && (
                        <TableCell className="tabular-nums">
                          {booth.stats.todayVisitors}
                        </TableCell>
                      )}
                      <TableCell className="tabular-nums">{booth._count.leads}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/events/${eventId}/exhibitors/form-config?boothId=${booth.id}`}
                            title="采集表单配置"
                            className={cn(
                              buttonVariants({ variant: "ghost", size: "icon" }),
                              "size-8",
                            )}
                          >
                            <ClipboardList className="size-3.5" />
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            title="编辑展位"
                            onClick={() => openEdit(booth)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-brand-red hover:text-brand-red"
                            title="删除展位"
                            onClick={() => {
                              if (
                                confirm(
                                  `确定删除展位 ${booth.code}？关联线索将一并删除。`,
                                )
                              ) {
                                deleteMutation.mutate(booth.id);
                              }
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableShell>
          )}
          </div>
        </SectionCard>
      </AdminContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "编辑展位" : "新建展位"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div>
              <Label>展位号</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="如 A101"
              />
            </div>
            <div>
              <Label>展位名称</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="如 智能硬件展区"
              />
            </div>
            <div>
              <Label>分配展商</Label>
              <Select
                value={form.exhibitorId}
                onValueChange={(v) =>
                  setForm({ ...form, exhibitorId: v ?? "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择展商">
                    {selectedExhibitorName || undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {exhibitorOptions.map((ex) => (
                    <SelectItem key={ex.id} value={ex.id}>
                      {ex.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>状态</Label>
              <Select
                value={form.status}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as BoothRow["status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue>{boothStatusLabel(form.status)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>展位类型</Label>
              {hallLabelOptions.length === 0 ? (
                <p className="mt-2 text-sm text-brand-amber">
                  暂无展位类型，请先到{" "}
                  <Link
                    href={`/events/${eventId}/expo-settings#booth-types`}
                    className="underline"
                  >
                    展会配置
                  </Link>{" "}
                  添加。
                </p>
              ) : (
                <Select
                  value={form.hallLabel || undefined}
                  onValueChange={(v) => {
                    const name = v ?? "";
                    const preset = boothTypeCatalog.find((t) => t.name === name);
                    setForm({
                      ...form,
                      hallLabel: name,
                      maxStaffCount:
                        preset?.defaultMaxStaffCount ?? form.maxStaffCount,
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择展位类型" />
                  </SelectTrigger>
                  <SelectContent>
                    {orphanHallLabel && (
                      <SelectItem value={orphanHallLabel} disabled>
                        （未登记）{orphanHallLabel}
                      </SelectItem>
                    )}
                    {boothTypeCatalog.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.name} · 默认 {t.defaultMaxStaffCount} 人
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {orphanHallLabel && (
                <p className="mt-1.5 text-xs text-brand-amber">
                  当前类型未在展会配置中，请改选已配置类型后再保存。
                </p>
              )}
            </div>
            <div>
              <Label>工作人员名额上限</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={form.maxStaffCount}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxStaffCount: Math.max(
                      1,
                      Math.min(99, Number(e.target.value) || 1),
                    ),
                  })
                }
              />
              <p className="mt-1.5 text-xs text-text-muted">
                该展位最多可添加几位工作人员账号；超出需调整此处或走加购流程
                {editing &&
                  `（当前已用 ${editing.staffQuota.currentCount} 位）`}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-brand-blue text-white"
              disabled={
                !form.code.trim() ||
                !form.name.trim() ||
                !form.exhibitorId ||
                !form.hallLabel.trim() ||
                Boolean(orphanHallLabel) ||
                hallLabelOptions.length === 0 ||
                saveMutation.isPending
              }
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? "保存中…" : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>按展位类型批量设置名额</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <p className="text-sm text-text-muted">
              将同一「展位类型」下的所有展位统一设置为相同的工作人员名额上限。
            </p>
            <div className="flex flex-wrap gap-2">
              {boothTypeCatalog.map((preset) => (
                <Button
                  key={preset.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBatchHallLabel(preset.name);
                    setBatchMaxStaff(preset.defaultMaxStaffCount);
                  }}
                >
                  {preset.name} · {preset.defaultMaxStaffCount} 人
                </Button>
              ))}
            </div>
            <div>
              <Label>展位类型</Label>
              <Select
                value={batchHallLabel || undefined}
                onValueChange={(v) => {
                  const name = v ?? "";
                  setBatchHallLabel(name);
                  const preset = boothTypeCatalog.find((t) => t.name === name);
                  if (preset) setBatchMaxStaff(preset.defaultMaxStaffCount);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择展位类型" />
                </SelectTrigger>
                <SelectContent>
                  {hallLabelOptions.map((label) => (
                    <SelectItem key={label} value={label}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>名额上限</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={batchMaxStaff}
                onChange={(e) =>
                  setBatchMaxStaff(
                    Math.max(1, Math.min(99, Number(e.target.value) || 1)),
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-brand-blue text-white"
              disabled={!batchHallLabel.trim() || batchMutation.isPending}
              onClick={() => batchMutation.mutate()}
            >
              {batchMutation.isPending ? "应用中…" : "应用到同类型展位"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
