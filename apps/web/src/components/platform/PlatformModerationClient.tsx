"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@/components/ui/data-table";
import { AdminContent } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ModerationItem } from "@/lib/moderation-service";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<string, string> = {
  QNA: "问答",
  CONNECTION: "连接附言",
  FEED: "动态",
};

async function fetchQueue() {
  const res = await fetch("/api/platform/moderation");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as {
    items: ModerationItem[];
    pendingCount: number;
  };
}

export function PlatformModerationClient() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"ALL" | "PENDING">("PENDING");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-moderation"],
    queryFn: fetchQueue,
    refetchInterval: 30_000,
  });

  const items = (data?.items ?? []).filter((i) =>
    filter === "ALL" ? true : i.status === "PENDING",
  );

  async function moderate(itemId: string, action: "approve" | "reject") {
    const res = await fetch(
      `/api/platform/moderation/${encodeURIComponent(itemId)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      },
    );
    if (!res.ok) {
      toast.error("操作失败");
      return;
    }
    toast.success(action === "approve" ? "已通过" : "已拒绝");
    void queryClient.invalidateQueries({ queryKey: ["platform-moderation"] });
  }

  const columns = useMemo<ColumnDef<ModerationItem>[]>(
    () => [
      {
        accessorKey: "type",
        header: "类型",
        cell: ({ row }) => TYPE_LABEL[row.original.type] ?? row.original.type,
      },
      { accessorKey: "title", header: "来源" },
      {
        accessorKey: "content",
        header: "内容",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-md text-sm">
            {row.original.content}
          </span>
        ),
      },
      { accessorKey: "author", header: "作者" },
      {
        accessorKey: "createdAt",
        header: "时间",
        cell: ({ row }) =>
          format(new Date(row.original.createdAt), "M/d HH:mm"),
      },
      {
        accessorKey: "status",
        header: "状态",
        cell: ({ row }) => (
          <Badge
            className={cn(
              row.original.status === "PENDING"
                ? "bg-brand-amber-light text-brand-amber"
                : row.original.status === "REJECTED"
                  ? "bg-brand-red-light text-brand-red"
                  : "bg-brand-green-light text-brand-green",
            )}
          >
            {row.original.status === "PENDING"
              ? "待审核"
              : row.original.status === "REJECTED"
                ? "已拒绝"
                : "已通过"}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.status === "PENDING" ? (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void moderate(row.original.id, "approve")}
              >
                通过
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-brand-red"
                onClick={() => void moderate(row.original.id, "reject")}
              >
                拒绝
              </Button>
            </div>
          ) : null,
      },
    ],
    [],
  );

  return (
    <AdminContent>
      <div className="mb-4 flex items-center gap-3">
        <Shield className="size-5 text-brand-red" />
        <Badge variant="destructive">{data?.pendingCount ?? 0} 待审核</Badge>
      </div>
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList>
          <TabsTrigger value="PENDING">待审核</TabsTrigger>
          <TabsTrigger value="ALL">全部</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="mt-4">
        <DataTable columns={columns} data={items} isLoading={isLoading} />
      </div>
    </AdminContent>
  );
}
