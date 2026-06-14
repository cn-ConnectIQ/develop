"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DataTable, type DataTableRow } from "@/components/ui/data-table";

type DemoUser = DataTableRow & {
  name: string;
  company: string;
  status: string;
  connections: number;
};

const MOCK_USERS: DemoUser[] = [
  {
    id: "1",
    name: "张伟",
    company: "未来科技",
    status: "活跃",
    connections: 12,
    isVip: true,
  },
  {
    id: "2",
    name: "李娜",
    company: "云端互动",
    status: "完整",
    connections: 8,
  },
  {
    id: "3",
    name: "王强",
    company: "智联会展",
    status: "SHADOW",
    connections: 0,
    isShadow: true,
  },
  {
    id: "4",
    name: "陈静",
    company: "数字营销实验室",
    status: "活跃",
    connections: 5,
  },
  {
    id: "5",
    name: "刘洋",
    company: "创新工场",
    status: "封禁",
    connections: 2,
  },
];

const PAGE_SIZE = 3;

export function DataTableExample() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return MOCK_USERS;
    return MOCK_USERS.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.company.toLowerCase().includes(q),
    );
  }, [search]);

  const pageData = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);

  const columns = useMemo<ColumnDef<DemoUser>[]>(
    () => [
      {
        id: "user",
        header: "用户",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="size-8">
              <AvatarFallback className="text-xs">
                {row.original.name.slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-text-muted">{row.original.company}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: "状态",
      },
      {
        accessorKey: "connections",
        header: "连接数",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.connections}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h2 className="mb-4 text-lg font-semibold">DataTable 使用示例</h2>
      <DataTable
        columns={columns}
        data={pageData}
        isLoading={loading}
        rowHeight={52}
        searchable
        searchPlaceholder="搜索姓名或公司..."
        onSearch={(query) => {
          setSearch(query);
          setPage(0);
        }}
        selectable
        bulkActions={[
          {
            label: "批量导出",
            onClick: (ids) => toast.success(`导出 ${ids.length} 条记录`),
          },
          {
            label: "批量封禁",
            variant: "destructive",
            onClick: (ids) => toast.warning(`封禁 ${ids.length} 个用户`),
          },
        ]}
        pagination={{
          total: filtered.length,
          pageSize: PAGE_SIZE,
          hasPrev: page > 0,
          hasNext: page < pageCount - 1,
          onPrev: () => setPage((p) => Math.max(0, p - 1)),
          onNext: () => setPage((p) => Math.min(pageCount - 1, p + 1)),
        }}
        emptyState={{
          icon: Users,
          title: "暂无用户",
          description: "调整搜索条件或导入用户数据",
          action: {
            label: "模拟加载",
            onClick: () => {
              setLoading(true);
              setTimeout(() => setLoading(false), 1200);
            },
          },
        }}
      />
    </div>
  );
}
