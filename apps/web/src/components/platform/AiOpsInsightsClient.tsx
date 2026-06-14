"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, subMonths, addMonths, parse } from "date-fns";
import { zhCN } from "date-fns/locale";
import { AdminContent } from "@/components/admin/admin-header";
import { StatCard, StatGrid } from "@/components/admin/stat-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

async function fetchStats(period: string) {
  const res = await fetch(
    `/api/platform/ai-ops/insights-stats?period=${period}`,
  );
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

function shiftPeriod(period: string, delta: number) {
  const base = parse(`${period}-01`, "yyyy-MM-dd", new Date());
  const next = delta < 0 ? subMonths(base, 1) : addMonths(base, 1);
  return format(next, "yyyy-MM");
}

export function AiOpsInsightsClient() {
  const [period, setPeriod] = useState(format(new Date(), "yyyy-MM"));
  const [previewId, setPreviewId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-ops-insights", period],
    queryFn: () => fetchStats(period),
  });

  const preview = data?.insights.find(
    (i: { id: string }) => i.id === previewId,
  );

  if (isLoading || !data) {
    return (
      <AdminContent>
        <div className="py-20 text-center text-sm text-text-muted">加载中...</div>
      </AdminContent>
    );
  }

  const periodLabel = format(
    parse(`${period}-01`, "yyyy-MM-dd", new Date()),
    "yyyy年M月",
    { locale: zhCN },
  );

  return (
    <AdminContent>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">月度洞察管理</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPeriod((p) => shiftPeriod(p, -1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[100px] text-center text-sm font-medium">
            {periodLabel}
          </span>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPeriod((p) => shiftPeriod(p, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <StatGrid columns={3}>
        <StatCard
          label="应生成用户数"
          value={data.coverage.target}
          accent="blue"
        />
        <div className="admin-card admin-card-pad-lg">
          <p className="mb-2 text-[12.5px] text-[var(--admin-gray)]">已生成</p>
          <p className="admin-metric-num text-brand-green">
            {data.coverage.generated}
            <span className="ml-1 text-lg text-text-muted">
              ({data.coverage.generatedRate}%)
            </span>
          </p>
          <Progress
            value={data.coverage.generatedRate}
            className="mt-3"
            indicatorClassName="bg-brand-green"
          />
        </div>
        <StatCard
          label="用户查看率"
          value={`${data.coverage.viewRate}%`}
          accent="amber"
          className="[&_.admin-metric-num]:text-4xl"
        />
      </StatGrid>

      <div className="admin-card mt-6 p-4">
        <h3 className="mb-3 text-sm font-semibold">生成状态分布</h3>
        <div className="flex h-10 overflow-hidden rounded-lg">
          {data.statusDistribution.map(
            (s: { status: string; count: number; color: string }) => (
              <div
                key={s.status}
                className="flex flex-col items-center justify-center px-1 text-[10px] text-white"
                style={{
                  backgroundColor: s.color,
                  width: `${(s.count / Math.max(data.coverage.target, 1)) * 100}%`,
                  minWidth: s.count > 0 ? "56px" : 0,
                }}
                title={`${s.status}: ${s.count}`}
              >
                <span className="font-medium">{s.count}</span>
                <span className="truncate opacity-80">{s.status}</span>
              </div>
            ),
          )}
        </div>
      </div>

      <div className="admin-card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-[#fafaf8] text-left text-text-muted">
              <th className="px-4 py-3">用户</th>
              <th className="px-4 py-3">生成时间</th>
              <th className="px-4 py-3">查看状态</th>
              <th className="px-4 py-3">操作</th>
            </tr>
          </thead>
          <tbody>
            {data.insights.map(
              (item: {
                id: string;
                name: string;
                generatedAt: string;
                viewed: boolean;
              }) => (
                <tr key={item.id} className="border-b border-border-light">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7">
                        <AvatarFallback className="text-xs">
                          {item.name.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      {item.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">
                    {format(new Date(item.generatedAt), "M/d HH:mm", {
                      locale: zhCN,
                    })}
                  </td>
                  <td className="px-4 py-3">
                    {item.viewed ? (
                      <span className="text-brand-green">已查看</span>
                    ) : (
                      <span className="text-text-muted">未查看</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-brand-blue"
                      onClick={() => setPreviewId(item.id)}
                    >
                      预览
                    </Button>
                    <Button variant="ghost" size="sm">
                      重新生成
                    </Button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>

      <Sheet open={!!previewId} onOpenChange={() => setPreviewId(null)}>
        <SheetContent className="w-full sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>洞察预览</SheetTitle>
          </SheetHeader>
          {preview && (
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{preview.name.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{preview.name}</p>
                  <p className="text-xs text-text-muted">
                    {format(new Date(preview.generatedAt), "yyyy/M/d HH:mm")}
                  </p>
                </div>
              </div>
              <p className="text-sm leading-relaxed">{preview.content}</p>
              <div>
                <p className="mb-2 text-sm font-semibold">行动建议</p>
                <ul className="list-inside list-disc space-y-1 text-sm text-text-muted">
                  {preview.actions.map((action: string) => (
                    <li key={action}>{action}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-2 pt-4">
                <Button className="flex-1 bg-brand-blue">重新生成</Button>
                <Button variant="outline" className="flex-1">
                  导出
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminContent>
  );
}
