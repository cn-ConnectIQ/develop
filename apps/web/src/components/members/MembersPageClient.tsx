"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Filter,
  MoreHorizontal,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { PageHead } from "@/components/admin/page-head";
import { MemberDetailSheet } from "@/components/members/MemberDetailSheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrgMemberListItem } from "@/lib/org-member-service";
import {
  formatRelativeActive,
  JoinSourceBadge,
  TierBadge,
} from "@/lib/member-utils";
import { cn } from "@/lib/utils";

type MemberRow = OrgMemberListItem & {
  isVip?: boolean;
};

async function fetchStats() {
  const res = await fetch("/api/org/members/stats");
  if (!res.ok) throw new Error("统计加载失败");
  return (await res.json()).data as {
    total: number;
    newThisMonth: number;
    monthOverMonthGrowth: number;
    active30d: number;
    activeRate: number;
    followerCount: number;
    growthTrend: Array<{ month: string; count: number }>;
    sourceDistribution: Array<{ name: string; value: number; color: string }>;
  };
}

async function fetchMembers(params: Record<string, string>) {
  const qs = new URLSearchParams(params);
  const res = await fetch(`/api/org/members?${qs}`);
  if (!res.ok) throw new Error("列表加载失败");
  const json = await res.json();
  return {
    items: json.data.items as OrgMemberListItem[],
    orgEvents: json.data.orgEvents as Array<{ id: string; name: string }>,
    orgTags: json.data.orgTags as string[],
    meta: json.meta as {
      total: number;
      page: number;
      pageSize: number;
      totalPages: number;
    },
  };
}

async function downloadExport(userIds?: string[]) {
  const res = await fetch("/api/org/members/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userIds?.length ? { user_ids: userIds } : {}),
  });
  if (!res.ok) {
    toast.error("导出失败");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "用户池导出.xlsx";
  a.click();
  URL.revokeObjectURL(url);
}

export function MembersPageClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [source, setSource] = useState("all");
  const [tier, setTier] = useState("all");
  const [eventId, setEventId] = useState("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const listParams = useMemo(
    () => ({
      page: String(page),
      pageSize: "20",
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
      source,
      tier,
      event_id: eventId,
      ...(selectedTags.length ? { tags: selectedTags.join(",") } : {}),
    }),
    [page, debouncedSearch, source, tier, eventId, selectedTags],
  );

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["org-members-stats"],
    queryFn: fetchStats,
  });

  const { data: listData, isLoading: listLoading } = useQuery({
    queryKey: ["org-members", listParams],
    queryFn: () => fetchMembers(listParams),
  });

  const rows: MemberRow[] = useMemo(
    () =>
      (listData?.items ?? []).map((item) => ({
        ...item,
        isVip: item.tier === "VIP",
      })),
    [listData?.items],
  );

  const refetchAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["org-members"] });
    void queryClient.invalidateQueries({ queryKey: ["org-members-stats"] });
  };

  function openDetail(userId: string) {
    setDetailUserId(userId);
    setSheetOpen(true);
  }

  const columns = useMemo<ColumnDef<MemberRow>[]>(
    () => [
      {
        id: "profile",
        header: "用户",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {row.original.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium">{row.original.name}</p>
              <p className="truncate text-xs text-text-muted">
                {row.original.company ?? "—"}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "source",
        header: "来源",
        cell: ({ row }) => <JoinSourceBadge source={row.original.joinSource} />,
      },
      {
        id: "sourceEvent",
        header: "来源活动",
        cell: ({ row }) => (
          <span className="block max-w-[120px] truncate text-xs text-text-muted">
            {row.original.sourceEventName ? `「${row.original.sourceEventName}」` : "—"}
          </span>
        ),
      },
      {
        id: "eventCount",
        header: "参与次数",
        cell: ({ row }) => (
          <span
            className={cn(
              "block text-center tabular-nums",
              row.original.eventCount >= 3 && "font-bold text-brand-blue",
            )}
          >
            {row.original.eventCount}
          </span>
        ),
      },
      {
        id: "lastActive",
        header: "最近活跃",
        cell: ({ row }) => (
          <span className="text-xs text-text-muted">
            {formatRelativeActive(row.original.lastActiveAt)}
          </span>
        ),
      },
      {
        id: "tier",
        header: "层级",
        cell: ({ row }) => <TierBadge tier={row.original.tier} />,
      },
      {
        id: "tags",
        header: "标签",
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (tags.length === 0) return <span className="text-xs text-text-muted">—</span>;
          const visible = tags.slice(0, 2);
          const rest = tags.length - visible.length;
          return (
            <div className="flex flex-wrap items-center gap-1">
              {visible.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-5 items-center rounded bg-brand-blue-light px-2 text-xs text-brand-blue"
                >
                  {tag}
                </span>
              ))}
              {rest > 0 && (
                <span className="text-xs text-text-muted">+{rest}</span>
              )}
            </div>
          );
        },
      },
      {
        id: "notes",
        header: "备注",
        cell: ({ row }) => (
          <span className="block max-w-[100px] truncate text-xs text-text-muted">
            {row.original.notes ? `「${row.original.notes}」` : "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-content">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openDetail(row.original.userId)}>
                查看详情
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openDetail(row.original.userId)}>
                编辑标签和层级
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info("通知功能即将开放")}
              >
                发送通知
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  const res = await fetch(
                    `/api/org/members/${row.original.userId}/export-marketup`,
                    { method: "POST" },
                  );
                  if (res.ok) toast.success("已加入 MarketUP 导出队列");
                  else toast.error("导出失败");
                }}
              >
                导出到 MarketUP
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-brand-red"
                onClick={async () => {
                  const res = await fetch(
                    `/api/org/members/${row.original.userId}`,
                    { method: "DELETE" },
                  );
                  if (res.ok) {
                    toast.success("已移除");
                    refetchAll();
                  } else toast.error("移除失败");
                }}
              >
                从用户池移除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [],
  );

  const growthPercent = Math.min(
    100,
    Math.max(0, (stats?.monthOverMonthGrowth ?? 0) + 50),
  );

  return (
    <AdminPageBody>
      <PageHead
        title="用户池"
        description="管理组织私域用户，追踪来源与活跃度"
      />

      {/* 统计卡 */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          loading={statsLoading}
          label="总用户"
          value={stats?.total ?? 0}
          valueClass="text-brand-blue"
          suffix="位用户"
          sub={
            stats && stats.monthOverMonthGrowth !== 0 ? (
              <span className="text-xs text-brand-green">
                较上月 {stats.monthOverMonthGrowth >= 0 ? "+" : ""}
                {stats.monthOverMonthGrowth}
              </span>
            ) : null
          }
        />
        <div className="admin-card admin-card-pad-lg">
          <p className="text-xs text-text-muted">本月新增</p>
          <p className="mt-1 text-4xl font-bold text-brand-green">
            {statsLoading ? "—" : stats?.newThisMonth}
          </p>
          <Progress
            className="mt-3 h-2 [&>div]:bg-brand-green"
            value={growthPercent}
          />
        </div>
        <StatCard
          loading={statsLoading}
          label="活跃用户（30天）"
          value={stats?.active30d ?? 0}
          valueClass="text-brand-blue"
          sub={
            <span className="text-xs text-text-muted">
              活跃率 {stats?.activeRate ?? 0}%
            </span>
          }
        />
        <StatCard
          loading={statsLoading}
          label="关注人数"
          value={stats?.followerCount ?? 0}
          valueClass="text-brand-purple"
          sub={
            <span className="text-xs text-text-muted">人关注了你的主页</span>
          }
        />
      </div>

      {/* 图表 */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="admin-card admin-card-pad-lg">
          <h3 className="mb-4 text-sm font-semibold">用户增长趋势</h3>
          <div className="h-[220px]">
            {statsLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                加载中...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.growthTrend ?? []}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke="#185FA5"
                    fill="#185FA520"
                    name="新增"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="admin-card admin-card-pad-lg">
          <h3 className="mb-4 text-sm font-semibold">用户来源分布</h3>
          <div className="h-[220px]">
            {statsLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-text-muted">
                加载中...
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats?.sourceDistribution ?? []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {(stats?.sourceDistribution ?? []).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* 筛选 */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          className="h-9 w-64"
          placeholder="搜索姓名/公司/手机"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={source}
          onValueChange={(v) => {
            if (!v) return;
            setSource(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue placeholder="来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部来源</SelectItem>
            <SelectItem value="participated">参与活动</SelectItem>
            <SelectItem value="lead">被采集</SelectItem>
            <SelectItem value="invited">邀请激活</SelectItem>
            <SelectItem value="followed">主动关注</SelectItem>
            <SelectItem value="qr">扫码</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={tier}
          onValueChange={(v) => {
            if (!v) return;
            setTier(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[120px]">
            <SelectValue placeholder="层级" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部层级</SelectItem>
            <SelectItem value="VIP">VIP</SelectItem>
            <SelectItem value="ACTIVE">ACTIVE</SelectItem>
            <SelectItem value="REGULAR">REGULAR</SelectItem>
            <SelectItem value="DORMANT">DORMANT</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={eventId}
          onValueChange={(v) => {
            if (!v) return;
            setEventId(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue placeholder="来源活动" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部活动</SelectItem>
            {(listData?.orgEvents ?? []).map((ev) => (
              <SelectItem key={ev.id} value={ev.id}>
                {ev.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(listData?.orgTags ?? []).length > 0 && (
          <Select
            value={selectedTags[0] ?? "all"}
            onValueChange={(v) => {
              if (!v) return;
              setSelectedTags(v === "all" ? [] : [v]);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue placeholder="标签" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部标签</SelectItem>
              {(listData?.orgTags ?? []).map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => toast.info("高级筛选即将开放")}
            aria-label="筛选"
          >
            <Filter className="size-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-background px-3 text-sm outline-none hover:bg-content">
              <Download className="size-4" />
              导出
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void downloadExport()}>
                导出 Excel
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info("MarketUP 批量导出即将开放")}
              >
                导出到 MarketUP
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={listLoading}
        rowHeight={56}
        selectable
        bulkActions={[
          {
            label: "发通知",
            onClick: () => toast.info("批量通知即将开放"),
          },
          {
            label: "批量打标签",
            onClick: () => toast.info("批量打标签即将开放"),
          },
          {
            label: "批量设置层级",
            onClick: () => toast.info("批量设置层级即将开放"),
          },
          {
            label: "导出所选",
            onClick: (ids) => {
              const userIds = rows
                .filter((r) => ids.includes(r.id))
                .map((r) => r.userId);
              void downloadExport(userIds);
            },
          },
        ]}
        pagination={
          listData?.meta
            ? {
                total: listData.meta.total,
                pageSize: listData.meta.pageSize,
                hasNext: listData.meta.page < listData.meta.totalPages,
                hasPrev: listData.meta.page > 1,
                onNext: () => setPage((p) => p + 1),
                onPrev: () => setPage((p) => Math.max(1, p - 1)),
              }
            : undefined
        }
        emptyState={{
          icon: Users,
          title: "用户池还是空的",
          description: "用户参加活动、被采集或关注你的组织后会出现在这里",
        }}
      />

      <MemberDetailSheet
        userId={detailUserId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={refetchAll}
      />
    </AdminPageBody>
  );
}

function StatCard({
  loading,
  label,
  value,
  valueClass,
  suffix,
  sub,
}: {
  loading?: boolean;
  label: string;
  value: number;
  valueClass: string;
  suffix?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="admin-card admin-card-pad-lg">
      <p className="text-xs text-text-muted">{label}</p>
      <p className={cn("mt-1 text-4xl font-bold", valueClass)}>
        {loading ? "—" : value.toLocaleString()}
      </p>
      {suffix && <p className="text-sm text-text-muted">{suffix}</p>}
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}
