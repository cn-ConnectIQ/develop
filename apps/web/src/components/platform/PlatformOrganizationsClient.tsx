"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2 } from "lucide-react";
import type { ColumnDef } from "@/components/ui/data-table";
import { AdminContent } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  adminStatus: string;
  totalEvents: number;
  totalParticipants: number;
  balances: {
    smsBalance: number;
    emailBalance: number;
    interactionPointsBalance: number;
  };
  usage: {
    smsUsed30d: number;
    emailUsed30d: number;
    interactionUsed30d: number;
  };
  owner: { id: string; name: string; email: string; phone: string | null } | null;
  updatedAt: string;
};

const STATUS_TABS = [
  { value: "ALL", label: "全部" },
  { value: "APPROVED", label: "已通过" },
  { value: "TRIAL", label: "试用" },
  { value: "PENDING_REVIEW", label: "待审" },
  { value: "SUSPENDED", label: "已挂起" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  APPROVED: "bg-brand-green-light text-brand-green",
  TRIAL: "bg-brand-blue-light text-brand-blue",
  PENDING_REVIEW: "bg-brand-amber-light text-brand-amber",
  SUSPENDED: "bg-brand-red-light text-brand-red",
  REJECTED: "bg-gray-100 text-text-muted",
};

const STATUS_LABEL: Record<string, string> = {
  APPROVED: "已通过",
  TRIAL: "试用",
  PENDING_REVIEW: "待审",
  SUSPENDED: "已挂起",
  REJECTED: "已拒绝",
};

async function fetchOrgs(search: string, status: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status !== "ALL") params.set("status", status);
  const res = await fetch(`/api/platform/organizations?${params}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as {
    items: OrgRow[];
    total: number;
    counts: Record<string, number>;
  };
}

export function PlatformOrganizationsClient() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-organizations", search, status],
    queryFn: () => fetchOrgs(search, status),
  });

  const columns = useMemo<ColumnDef<OrgRow>[]>(
    () => [
      {
        id: "org",
        header: "组织",
        cell: ({ row }) => (
          <div>
            <p className="font-medium">{row.original.name}</p>
            <p className="text-xs text-text-muted">{row.original.slug}</p>
          </div>
        ),
      },
      {
        id: "status",
        header: "状态",
        cell: ({ row }) => (
          <Badge
            className={cn(
              "border-0 font-normal",
              STATUS_BADGE[row.original.adminStatus] ?? "bg-muted",
            )}
          >
            {STATUS_LABEL[row.original.adminStatus] ?? row.original.adminStatus}
          </Badge>
        ),
      },
      {
        id: "owner",
        header: "管理员",
        cell: ({ row }) =>
          row.original.owner ? (
            <div>
              <p className="text-sm">{row.original.owner.name}</p>
              <p className="text-xs text-text-muted">{row.original.owner.email}</p>
            </div>
          ) : (
            <span className="text-text-muted">—</span>
          ),
      },
      {
        id: "counts",
        header: "活动 / 参会",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.totalEvents} / {row.original.totalParticipants}
          </span>
        ),
      },
      {
        id: "balances",
        header: "短信 / 邮件 / 互动点",
        cell: ({ row }) => (
          <span className="tabular-nums text-sm">
            {row.original.balances.smsBalance} /{" "}
            {row.original.balances.emailBalance} /{" "}
            {row.original.balances.interactionPointsBalance}
          </span>
        ),
      },
      {
        id: "usage",
        header: "近30天消耗",
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-text-muted">
            短{row.original.usage.smsUsed30d} · 邮
            {row.original.usage.emailUsed30d} · 互
            {row.original.usage.interactionUsed30d}
          </span>
        ),
      },
      {
        id: "updated",
        header: "更新",
        cell: ({ row }) => (
          <span className="text-xs text-text-muted">
            {format(new Date(row.original.updatedAt), "yyyy-MM-dd")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Link
            href={`/platform/organizations/${row.original.id}`}
            className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-8")}
          >
            详情
          </Link>
        ),
      },
    ],
    [],
  );

  return (
    <AdminContent>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Building2 className="size-5 text-brand-green" />
          账号台账
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          查看各主办账号的活动、参会、短信/邮件/互动点余额与消耗，并可代充、挂起。
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="搜索组织名、slug、邮箱…"
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                {tab.label}
                {data?.counts && tab.value === "ALL"
                  ? ` (${data.counts.all ?? 0})`
                  : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={isLoading}
        emptyState={{
          icon: Building2,
          title: "暂无组织账号",
          description: "审核通过或创建体验后会出现在此列表",
        }}
      />
    </AdminContent>
  );
}
