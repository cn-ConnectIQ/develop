"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type ProgressRow = {
  user_id: string;
  user_name: string;
  user_company: string | null;
  stamp_count: number;
  required_count: number;
  completed: boolean;
  redeemed: boolean;
  last_stamped_at: string | null;
};

async function fetchProgress(eventId: string, rallyId: string) {
  const res = await fetch(
    `/api/events/${eventId}/stamp-rallies/${rallyId}/progress`,
  );
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.progress as ProgressRow[];
}

export function StampRallyProgressClient({
  eventId,
  rallyId,
  rallyName,
}: {
  eventId: string;
  rallyId: string;
  rallyName: string;
}) {
  const { data = [], isLoading } = useQuery({
    queryKey: ["stamp-rally-progress", eventId, rallyId],
    queryFn: () => fetchProgress(eventId, rallyId),
  });

  return (
    <AdminPage>
      <AdminHeader
        title="集章进度"
        description={rallyName}
        breadcrumb={["互动管理", "集章打卡", "进度"]}
      />
      <AdminContent>
        {isLoading ? (
          <p className="py-12 text-center text-text-muted">加载中...</p>
        ) : data.length === 0 ? (
          <p className="py-12 text-center text-text-muted">暂无打卡记录</p>
        ) : (
          <div className="space-y-3">
            {data.map((row) => (
              <div
                key={row.user_id}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border-light bg-white p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{row.user_name}</p>
                    {row.completed && (
                      <Badge className="bg-brand-green-light text-brand-green">
                        已完成
                      </Badge>
                    )}
                    {row.redeemed && (
                      <Badge className="bg-brand-blue-light text-brand-blue">
                        已兑换
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-text-muted">
                    {row.user_company ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-brand-blue">
                    {row.stamp_count}/{row.required_count}
                  </p>
                  <p className="text-xs text-text-muted">已集章</p>
                </div>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full bg-brand-blue transition-all"
                    style={{
                      width: `${Math.min(100, (row.stamp_count / row.required_count) * 100)}%`,
                    }}
                  />
                </div>
                <Link
                  href={`/users/${row.user_id}`}
                  className="text-xs text-brand-blue hover:underline"
                >
                  查看名片
                </Link>
              </div>
            ))}
          </div>
        )}
      </AdminContent>
    </AdminPage>
  );
}
