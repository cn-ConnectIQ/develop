"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Users } from "lucide-react";
import type { ColumnDef } from "@/components/ui/data-table";
import { AdminContent } from "@/components/admin/admin-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ApplicationReviewSheet,
  type ApplicationRow,
} from "@/components/platform/ApplicationReviewSheet";
import { maskCreditCode, maskPhone } from "@/lib/platform-application-service";
import type { AccountType } from "@connectiq/database";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { value: "ALL", label: "全部" },
  { value: "PENDING", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已拒绝" },
] as const;

const TYPE_BADGE: Record<AccountType, string> = {
  CONFERENCE_ORGANIZER: "bg-brand-blue-light text-brand-blue",
  EXPO_ORGANIZER: "bg-brand-green-light text-brand-green",
  EXHIBITOR: "bg-brand-amber-light text-brand-amber",
};

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-brand-amber-light text-brand-amber",
  APPROVED: "bg-brand-green-light text-brand-green",
  REJECTED: "bg-brand-red-light text-brand-red",
};

async function fetchApplications(status: string, accountType: string) {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  if (accountType !== "ALL") params.set("type", accountType);
  const res = await fetch(`/api/platform/applications?${params}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as {
    items: ApplicationRow[];
    total: number;
    counts: { pending: number; approved: number; rejected: number };
  };
}

export function PlatformApplicationsClient() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [accountType, setAccountType] = useState("ALL");
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-applications", status, accountType],
    queryFn: () => fetchApplications(status, accountType),
  });

  const columns = useMemo<ColumnDef<ApplicationRow>[]>(
    () => [
      {
        id: "applicant",
        header: "申请人",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">
                {row.original.user.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{row.original.user.name}</p>
              <p className="text-xs text-text-muted">
                {maskPhone(row.original.user.phone)}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "orgName",
        header: "组织名",
        cell: ({ row }) => (
          <span className="font-medium">{row.original.orgName}</span>
        ),
      },
      {
        id: "accountType",
        header: "账号类型",
        cell: ({ row }) => (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              TYPE_BADGE[row.original.accountType],
            )}
          >
            {row.original.accountTypeLabel}
          </span>
        ),
      },
      {
        id: "creditCode",
        header: "信用代码",
        cell: ({ row }) =>
          row.original.orgCreditCode ? (
            maskCreditCode(row.original.orgCreditCode)
          ) : (
            <span className="text-text-muted">未提供</span>
          ),
      },
      {
        id: "submittedAt",
        header: "提交时间",
        cell: ({ row }) =>
          format(new Date(row.original.submittedAt), "yyyy-MM-dd HH:mm", {
            locale: zhCN,
          }),
      },
      {
        id: "status",
        header: "状态",
        cell: ({ row }) => (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              STATUS_BADGE[row.original.status],
            )}
          >
            {row.original.status === "PENDING"
              ? "待审核"
              : row.original.status === "APPROVED"
                ? "已通过"
                : "已拒绝"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <Button
            type="button"
            size="sm"
            variant={row.original.status === "PENDING" ? "default" : "outline"}
            className={
              row.original.status === "PENDING"
                ? "bg-brand-blue hover:bg-[#14538f]"
                : undefined
            }
            onClick={() => {
              setSelected(row.original);
              setSheetOpen(true);
            }}
          >
            {row.original.status === "PENDING" ? "审核" : "查看"}
          </Button>
        ),
      },
    ],
    [],
  );

  const tableData = (data?.items ?? []).map((item) => ({
    ...item,
    highlight: item.status === "PENDING" ? ("amber" as const) : undefined,
  }));

  return (
    <AdminContent>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-xl font-bold">账号申请审核</h1>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-brand-amber-light text-brand-amber hover:bg-brand-amber-light">
            {data?.counts.pending ?? 0} 待审核
          </Badge>
          <Badge className="bg-brand-green-light text-brand-green hover:bg-brand-green-light">
            {data?.counts.approved ?? 0} 已通过
          </Badge>
          <Badge variant="secondary" className="bg-content-bg text-text-muted">
            {data?.counts.rejected ?? 0} 已拒绝
          </Badge>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Select
          value={accountType}
          onValueChange={(v) => setAccountType(v ?? "ALL")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="账号类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">全部类型</SelectItem>
            <SelectItem value="CONFERENCE_ORGANIZER">会议主办方</SelectItem>
            <SelectItem value="EXPO_ORGANIZER">展会主办方</SelectItem>
            <SelectItem value="EXHIBITOR">参展商</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={tableData}
        isLoading={isLoading}
        rowHeight={64}
        emptyState={{
          icon: Users,
          title: "暂无申请记录",
          description: "新的账号管理员申请将显示在这里",
        }}
      />

      <ApplicationReviewSheet
        application={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onReviewed={() =>
          void queryClient.invalidateQueries({
            queryKey: ["platform-applications"],
          })
        }
      />
    </AdminContent>
  );
}
