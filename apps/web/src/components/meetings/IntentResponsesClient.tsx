"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, Tags, Users } from "lucide-react";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  ApiIntentResponsesResult,
  ApiIntentTagStat,
} from "@/lib/intent-responses-service";

async function fetchIntentResponses(
  eventId: string,
): Promise<ApiIntentResponsesResult> {
  const res = await fetch(`/api/events/${eventId}/intent-responses`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
      {sub && <p className="mt-1 text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

function TagCloud({
  title,
  tags,
  emptyHint,
}: {
  title: string;
  tags: ApiIntentTagStat[];
  emptyHint: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="mb-3 text-sm font-medium text-text">{title}</p>
      {tags.length === 0 ? (
        <p className="text-sm text-text-muted">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span
              key={`${t.pool}-${t.tag}`}
              className="inline-flex items-center gap-1 rounded-full bg-primary/8 px-3 py-1 text-xs text-text"
            >
              {t.tag}
              <span className="font-semibold text-primary">{t.count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className="text-text-muted">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded bg-muted px-1.5 py-0.5 text-xs text-text"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

export function IntentResponsesClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["intent-responses", eventId],
    queryFn: () => fetchIntentResponses(eventId),
  });

  const stats = data?.stats;
  const rows = data?.rows ?? [];

  return (
    <AdminPage>
      <AdminHeader
        title="意图采集结果"
        description={eventName}
        breadcrumb={["活动", "匹配预热", "采集结果"]}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/events/${eventId}/matchmaking`}
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              <ArrowLeft className="mr-1 size-4" />
              返回配置
            </Link>
            <Button
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className="mr-1 size-4" />
              刷新
            </Button>
          </div>
        }
      />
      <AdminContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="已填写人数"
            value={stats?.submitted_count ?? "—"}
            sub={
              stats
                ? `填写率 ${stats.fill_rate}%（基准 ${stats.eligible_count} 人）`
                : undefined
            }
          />
          <StatTile
            label="填写供给"
            value={stats?.with_supply ?? "—"}
            sub="至少选 1 个「我能提供」"
          />
          <StatTile
            label="填写需求"
            value={stats?.with_demand ?? "—"}
            sub="至少选 1 个「我在寻找」"
          />
          <StatTile
            label="填写角色/话题"
            value={
              stats
                ? `${stats.with_role} / ${stats.with_topics}`
                : "—"
            }
            sub="角色 · 话题"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <TagCloud
            title="热门供给标签"
            tags={stats?.top_supply_tags ?? []}
            emptyHint="暂无供给标签数据"
          />
          <TagCloud
            title="热门需求标签"
            tags={stats?.top_demand_tags ?? []}
            emptyHint="暂无需求标签数据"
          />
          <TagCloud
            title="热门话题"
            tags={stats?.top_topics ?? []}
            emptyHint="暂无话题数据"
          />
        </div>

        <SectionCard
          title="参会者意图明细"
          description="对应移动端 MT7 增强意图采集 · 供会前匹配与 AI 推荐理由"
          action={
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <Users className="size-3.5" />
              {rows.length} 条
            </div>
          }
        >
          {isLoading ? (
            <p className="py-8 text-center text-sm text-text-muted">加载中…</p>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <Tags className="mx-auto mb-3 size-8 text-text-muted/50" />
              <p className="text-sm text-text-muted">尚无参会者提交意图</p>
              <p className="mt-1 text-xs text-text-muted">
                开启会前预热后，参会者可在小程序完善资料并填写意图标签
              </p>
              <Link
                href={`/events/${eventId}/matchmaking`}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "mt-4",
                )}
              >
                去配置匹配预热
              </Link>
            </div>
          ) : (
            <DataTable
              data={rows}
              getRowKey={(row) => row.id}
              columns={[
                {
                  key: "user",
                  header: "参会者",
                  cell: (row) => (
                    <div>
                      <p className="font-medium">{row.user.name}</p>
                      {(row.user.company || row.user.industry) && (
                        <p className="text-xs text-text-muted">
                          {[row.user.company, row.user.industry]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                  ),
                },
                {
                  key: "role",
                  header: "角色",
                  cell: (row) => row.role ?? "—",
                },
                {
                  key: "supply",
                  header: "我能提供",
                  cell: (row) => <TagList tags={row.supply_tags} />,
                },
                {
                  key: "demand",
                  header: "我在寻找",
                  cell: (row) => <TagList tags={row.demand_tags} />,
                },
                {
                  key: "topics",
                  header: "关注话题",
                  cell: (row) => <TagList tags={row.topics} />,
                },
                {
                  key: "updated",
                  header: "更新时间",
                  cell: (row) =>
                    new Date(row.updated_at).toLocaleString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                },
              ]}
            />
          )}
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
