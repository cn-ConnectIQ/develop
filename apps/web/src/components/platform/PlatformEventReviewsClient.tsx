"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { CalendarCheck, CheckCircle2 } from "lucide-react";
import type { ColumnDef } from "@/components/ui/data-table";
import { AdminContent } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EventReviewSheet,
  type EventReviewRow,
} from "@/components/platform/EventReviewSheet";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { value: "ALL", label: "全部" },
  { value: "PENDING_REVIEW", label: "待审核" },
  { value: "APPROVED", label: "已通过" },
  { value: "REJECTED", label: "已拒绝" },
  { value: "REVISION_REQUIRED", label: "需修改" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  PENDING_REVIEW: "bg-brand-blue-light text-brand-blue",
  APPROVED: "bg-brand-green-light text-brand-green",
  REJECTED: "bg-brand-red-light text-brand-red",
  REVISION_REQUIRED: "bg-brand-amber-light text-brand-amber",
};

async function fetchEventReviews(status: string) {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  const res = await fetch(`/api/platform/event-reviews?${params}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as {
    items: EventReviewRow[];
    total: number;
  };
}

export function PlatformEventReviewsClient() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("PENDING_REVIEW");
  const [selected, setSelected] = useState<EventReviewRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["platform-event-reviews", status],
    queryFn: () => fetchEventReviews(status),
  });

  const columns = useMemo<ColumnDef<EventReviewRow>[]>(
    () => [
      {
        id: "event",
        header: "活动",
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-brand-blue-light text-xs text-brand-blue">
              封面
            </div>
            <span className="font-medium">{row.original.event.name}</span>
          </div>
        ),
      },
      {
        id: "org",
        header: "主办组织",
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 text-sm">
            <span>{row.original.event.org?.name ?? "—"}</span>
            {row.original.event.org?.isVerified && (
              <CheckCircle2 className="size-3.5 text-brand-blue" />
            )}
          </div>
        ),
      },
      {
        id: "type",
        header: "类型",
        cell: ({ row }) => (
          <span className="rounded-full bg-brand-blue-light px-2 py-0.5 text-xs text-brand-blue">
            {row.original.event.typeLabel}
          </span>
        ),
      },
      {
        id: "startDate",
        header: "活动时间",
        cell: ({ row }) =>
          row.original.event.startDate
            ? format(new Date(row.original.event.startDate), "yyyy-MM-dd", {
                locale: zhCN,
              })
            : "—",
      },
      {
        id: "submittedAt",
        header: "提交时间",
        cell: ({ row }) =>
          format(new Date(row.original.submittedAt), "MM-dd HH:mm", {
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
            {row.original.statusLabel}
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
            className="bg-brand-blue hover:bg-[#14538f]"
            onClick={() => {
              setSelected(row.original);
              setSheetOpen(true);
            }}
          >
            审核
          </Button>
        ),
      },
    ],
    [],
  );

  const tableData = (data?.items ?? []).map((item) => ({
    ...item,
    highlight:
      item.status === "PENDING_REVIEW" ? ("blue" as const) : undefined,
  }));

  return (
    <AdminContent>
      <h1 className="mb-6 text-xl font-bold">活动发布审核</h1>

      <Tabs value={status} onValueChange={setStatus} className="mb-4">
        <TabsList>
          {STATUS_TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={tableData}
        isLoading={isLoading}
        rowHeight={72}
        emptyState={{
          icon: CalendarCheck,
          title: "暂无活动审核记录",
          description: "主办方提交的活动发布申请将显示在这里",
        }}
      />

      <EventReviewSheet
        review={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onReviewed={() =>
          void queryClient.invalidateQueries({
            queryKey: ["platform-event-reviews"],
          })
        }
      />
    </AdminContent>
  );
}
