"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { AdminContent } from "@/components/admin/admin-header";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const STATUS_TABS = ["全部", "SHADOW", "活跃", "完整", "封禁"];

async function fetchUsers(search: string, status: string) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status && status !== "全部") params.set("status", status);
  const res = await fetch(`/api/platform/users?${params}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as {
    users: Array<{
      id: string;
      name: string;
      company: string;
      phone: string | null;
      source: string;
      status: string;
      connections: number;
      createdAt: string;
    }>;
    total: number;
  };
}

async function fetchUserDetail(userId: string) {
  const res = await fetch(`/api/platform/users/${userId}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "SHADOW":
      return "bg-gray-100 text-text-muted";
    case "BANNED":
      return "bg-brand-red-light text-brand-red";
    case "COMPLETE":
      return "bg-brand-green-light text-brand-green";
    default:
      return "bg-brand-blue-light text-brand-blue";
  }
}

export function PlatformUsersClient() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("全部");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailTab, setDetailTab] = useState("basic");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-users", search, status],
    queryFn: () => fetchUsers(search, status),
  });

  const { data: detail } = useQuery({
    queryKey: ["platform-user", selectedId],
    queryFn: () => fetchUserDetail(selectedId!),
    enabled: !!selectedId,
  });

  const users = data?.users ?? [];
  const allSelected = users.length > 0 && users.every((u) => selectedIds.has(u.id));

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(users.map((u) => u.id)) : new Set());
  }

  async function revokeRole(role: string, entityId: string | null) {
    if (!selectedId) return;
    const res = await fetch(`/api/platform/users/${selectedId}/role`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, entityId, action: "revoke" }),
    });
    if (res.ok) {
      toast.success("角色已撤销");
      void queryClient.invalidateQueries({ queryKey: ["platform-user", selectedId] });
    } else {
      toast.error("撤销失败");
    }
  }

  const depthChart =
    detail?.connections.depthDistribution.map(
      (count: number, i: number) => ({
        depth: `深度 ${i + 1}`,
        count,
      }),
    ) ?? [];

  return (
    <AdminContent>
      <h1 className="mb-6 text-xl font-bold">用户管理</h1>

      <div className="mb-4 flex flex-wrap gap-3">
        <Input
          placeholder="搜索姓名、邮箱、手机..."
          className="max-w-xs"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="text-xs">
                {tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex items-center gap-3 rounded-lg bg-sidebar-shell px-4 py-3 text-sm text-white">
          <span>已选 {selectedIds.size} 人</span>
          <Button size="sm" variant="secondary" className="h-8">
            批量导出
          </Button>
          <Button size="sm" variant="secondary" className="h-8 text-brand-amber">
            批量封禁
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-8 text-white/70"
            onClick={() => setSelectedIds(new Set())}
          >
            取消选择
          </Button>
        </div>
      )}

      <div className="admin-card overflow-hidden">
        {isLoading ? (
          <div className="py-16 text-center text-sm text-text-muted">加载中...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafaf8] text-left text-text-muted">
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(v) => toggleAll(v === true)}
                  />
                </th>
                <th className="px-4 py-3">用户</th>
                <th className="px-4 py-3">手机</th>
                <th className="px-4 py-3">来源</th>
                <th className="px-4 py-3">状态</th>
                <th className="px-4 py-3">连接数</th>
                <th className="px-4 py-3">注册时间</th>
                <th className="px-4 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className={cn(
                    "h-[52px] border-b border-border-light",
                    user.status === "SHADOW" && "bg-[#FAFAFA]",
                  )}
                >
                  <td className="px-4">
                    <Checkbox
                      checked={selectedIds.has(user.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(selectedIds);
                        if (v) next.add(user.id);
                        else next.delete(user.id);
                        setSelectedIds(next);
                      }}
                    />
                  </td>
                  <td className="px-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarFallback className="text-xs">
                          {user.name.slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <p className="text-xs text-text-muted">{user.company}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 text-text-muted">{user.phone ?? "—"}</td>
                  <td className="px-4">
                    <span className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                      {user.source}
                    </span>
                  </td>
                  <td className="px-4">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs",
                        statusBadgeClass(user.status),
                      )}
                    >
                      {user.status}
                    </span>
                  </td>
                  <td className="px-4">{user.connections}</td>
                  <td className="px-4 text-text-muted">
                    {format(new Date(user.createdAt), "yyyy/M/d")}
                  </td>
                  <td className="px-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-brand-blue"
                      onClick={() => {
                        setSelectedId(user.id);
                        setDetailTab("basic");
                      }}
                    >
                      详情
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Sheet open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-[480px]">
          <SheetHeader>
            <SheetTitle>{detail?.name ?? "用户详情"}</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="mt-4">
              <Tabs value={detailTab} onValueChange={setDetailTab}>
                <TabsList className="mb-4 flex h-auto flex-wrap">
                  {[
                    { id: "basic", label: "基本信息" },
                    { id: "identity", label: "账号绑定" },
                    { id: "events", label: "活动历史" },
                    { id: "connections", label: "连接数据" },
                    { id: "points", label: "积分历史" },
                    { id: "feed", label: "Feed 记录" },
                    { id: "roles", label: "角色权限" },
                  ].map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="basic">
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="text-text-muted">邮箱</dt>
                      <dd>{detail.email}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">行业</dt>
                      <dd>{detail.industry}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">意图标签</dt>
                      <dd>{detail.tags.join("、") || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-text-muted">价值主张</dt>
                      <dd>{detail.valueProposition}</dd>
                    </div>
                  </dl>
                </TabsContent>

                <TabsContent value="identity">
                  <ul className="space-y-2 text-sm">
                    {detail.identities.map(
                      (id: { provider: string; value: string; verified: boolean }) => (
                        <li
                          key={id.provider}
                          className="flex justify-between rounded border p-2"
                        >
                          <span className="uppercase text-text-muted">{id.provider}</span>
                          <span>{id.value}</span>
                        </li>
                      ),
                    )}
                  </ul>
                </TabsContent>

                <TabsContent value="events">
                  <ul className="space-y-3 text-sm">
                    {detail.events.map(
                      (e: { id: string; name: string; type: string; startDate: string | null }) => (
                        <li key={e.id} className="border-l-2 border-brand-blue pl-3">
                          <p className="font-medium">{e.name}</p>
                          <p className="text-xs text-text-muted">
                            {e.type}
                            {e.startDate &&
                              ` · ${format(new Date(e.startDate), "yyyy/M/d", { locale: zhCN })}`}
                          </p>
                        </li>
                      ),
                    )}
                  </ul>
                </TabsContent>

                <TabsContent value="connections">
                  <p className="mb-3 text-sm">
                    连接总数：
                    <span className="font-bold text-brand-purple">
                      {detail.connections.total}
                    </span>
                  </p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={depthChart}>
                        <XAxis dataKey="depth" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#534AB7" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>

                <TabsContent value="points">
                  <p className="mb-3 text-lg font-bold text-brand-gold">
                    余额 {detail.points.balance}
                  </p>
                  <ul className="space-y-2 text-sm">
                    {detail.points.ledger.map(
                      (p: { id: string; amount: number; reason: string; createdAt: string }) => (
                        <li
                          key={p.id}
                          className="flex justify-between border-b py-2"
                        >
                          <div>
                            <p>{p.reason}</p>
                            <p className="text-xs text-text-muted">
                              {format(new Date(p.createdAt), "M/d HH:mm")}
                            </p>
                          </div>
                          <span
                            className={
                              p.amount > 0 ? "text-brand-green" : "text-brand-red"
                            }
                          >
                            {p.amount > 0 ? "+" : ""}
                            {p.amount}
                          </span>
                        </li>
                      ),
                    )}
                  </ul>
                </TabsContent>

                <TabsContent value="feed">
                  <ul className="space-y-2 text-sm">
                    {detail.feed.map(
                      (f: {
                        id: string;
                        type: string;
                        content: string;
                        aiScore: number | null;
                        triggerReason: string | null;
                      }) => (
                        <li key={f.id} className="rounded border p-3">
                          <span className="rounded bg-brand-purple-light px-1.5 py-0.5 text-[10px] text-brand-purple">
                            {f.type}
                          </span>
                          <p className="mt-1">{f.content}</p>
                          <p className="mt-1 text-xs text-text-muted">
                            AI {f.aiScore ?? "—"} · {f.triggerReason ?? "—"}
                          </p>
                        </li>
                      ),
                    )}
                  </ul>
                </TabsContent>

                <TabsContent value="roles">
                  <ul className="space-y-2 text-sm">
                    {detail.roles.map(
                      (r: { id: string; role: string; entityId: string | null }) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between rounded border p-2"
                        >
                          <span>{r.role}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-brand-red"
                            onClick={() => void revokeRole(r.role, r.entityId)}
                          >
                            撤销
                          </Button>
                        </li>
                      ),
                    )}
                  </ul>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminContent>
  );
}
