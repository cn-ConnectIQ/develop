"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Clock, Sparkles, UserCheck } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@/components/ui/data-table";
import { AdminContent, AdminHeader, AdminPage } from "@/components/admin/admin-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { maskPhone } from "@/lib/mask-utils";
import { EXPERIENCE_DEFAULT_EXTEND_DAYS } from "@/lib/experience/experience-config";
import { cn } from "@/lib/utils";

export type ExperienceAccountRow = {
  id: string;
  user: { id: string; name: string; phone: string | null; email: string };
  org: { id: string; name: string; slug: string };
  event: { id: string; name: string; slug: string };
  inviter: { id: string; name: string; phone: string | null } | null;
  role: "PRIMARY" | "COLLEAGUE";
  status: "ACTIVE" | "EXPIRED" | "CONVERTED" | "REVOKED";
  phone: string;
  contactName: string | null;
  companyName: string | null;
  startedAt: string;
  expiresAt: string;
  extendedCount: number;
  convertedAt: string | null;
  platformNotes: string | null;
  createdAt: string;
};

const STATUS_TABS = [
  { value: "ALL", label: "全部" },
  { value: "ACTIVE", label: "进行中" },
  { value: "EXPIRED", label: "已过期" },
  { value: "CONVERTED", label: "已转正" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-brand-green-light text-brand-green",
  EXPIRED: "bg-brand-amber-light text-brand-amber",
  CONVERTED: "bg-brand-blue-light text-brand-blue",
  REVOKED: "bg-brand-red-light text-brand-red",
};

async function fetchExperienceAccounts(status: string) {
  const params = new URLSearchParams();
  if (status !== "ALL") params.set("status", status);
  const res = await fetch(`/api/platform/experience-accounts?${params}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as {
    items: ExperienceAccountRow[];
    total: number;
    counts: { active: number; expired: number; converted: number };
  };
}

export function PlatformExperienceAccountsClient() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("ALL");
  const [extendTarget, setExtendTarget] = useState<ExperienceAccountRow | null>(null);
  const [convertTarget, setConvertTarget] = useState<ExperienceAccountRow | null>(null);
  const [extendDays, setExtendDays] = useState(String(EXPERIENCE_DEFAULT_EXTEND_DAYS));
  const [extendNotes, setExtendNotes] = useState("");
  const [orgName, setOrgName] = useState("");
  const [convertNotes, setConvertNotes] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["platform-experience-accounts", status],
    queryFn: () => fetchExperienceAccounts(status),
  });

  const extendMutation = useMutation({
    mutationFn: async () => {
      if (!extendTarget) throw new Error("未选择账号");
      const res = await fetch(
        `/api/platform/experience-accounts/${extendTarget.id}/extend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            days: Number(extendDays),
            notes: extendNotes || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "延期失败");
      return json.data;
    },
    onSuccess: () => {
      toast.success("体验账号已延期");
      setExtendTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["platform-experience-accounts"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "延期失败");
    },
  });

  const convertMutation = useMutation({
    mutationFn: async () => {
      if (!convertTarget) throw new Error("未选择账号");
      const res = await fetch(
        `/api/platform/experience-accounts/${convertTarget.id}/convert`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgName,
            notes: convertNotes || undefined,
          }),
        },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "转正失败");
      return json.data;
    },
    onSuccess: (result) => {
      toast.success(`已转为正式账号：${result.orgName}`);
      setConvertTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["platform-experience-accounts"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "转正失败");
    },
  });

  const columns = useMemo<ColumnDef<ExperienceAccountRow>[]>(
    () => [
      {
        id: "user",
        header: "体验用户",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarFallback className="text-xs">
                {(row.original.contactName ?? row.original.user.name).slice(0, 1)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">
                {row.original.contactName ?? row.original.user.name}
              </p>
              <p className="text-xs text-text-muted">{maskPhone(row.original.phone)}</p>
            </div>
          </div>
        ),
      },
      {
        id: "role",
        header: "类型",
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.role === "PRIMARY" ? "主账号" : "同事"}
          </span>
        ),
      },
      {
        id: "company",
        header: "公司/单位",
        cell: ({ row }) => (
          <span className="text-sm text-text-muted">
            {row.original.companyName ?? "—"}
          </span>
        ),
      },
      {
        id: "event",
        header: "演示活动",
        cell: ({ row }) => (
          <span className="text-sm">{row.original.event.name}</span>
        ),
      },
      {
        id: "expiresAt",
        header: "到期时间",
        cell: ({ row }) =>
          format(new Date(row.original.expiresAt), "yyyy-MM-dd HH:mm", {
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
            {row.original.status === "ACTIVE"
              ? "进行中"
              : row.original.status === "EXPIRED"
                ? "已过期"
                : row.original.status === "CONVERTED"
                  ? "已转正"
                  : "已撤销"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) => (
          <div className="flex gap-2">
            {row.original.status !== "CONVERTED" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setExtendTarget(row.original);
                  setExtendDays(String(EXPERIENCE_DEFAULT_EXTEND_DAYS));
                  setExtendNotes("");
                }}
              >
                <Clock className="mr-1 size-3.5" />
                延期
              </Button>
            )}
            {row.original.role === "PRIMARY" &&
              row.original.status !== "CONVERTED" && (
                <Button
                  size="sm"
                  onClick={() => {
                    setConvertTarget(row.original);
                    setOrgName(
                      row.original.companyName ??
                        `${row.original.contactName ?? row.original.user.name}的组织`,
                    );
                    setConvertNotes("");
                  }}
                >
                  <UserCheck className="mr-1 size-3.5" />
                  转正式
                </Button>
              )}
          </div>
        ),
      },
    ],
    [],
  );

  return (
    <AdminPage>
      <AdminHeader
        title="体验账号管理"
        description="演示展会 TEST1377 的一键体验申请，可延期或转为正式账号"
        breadcrumb={["审核中心", "体验账号"]}
        actions={
          data ? (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Sparkles className="size-4 text-brand-green" />
              进行中 {data.counts.active} · 已过期 {data.counts.expired} · 已转正{" "}
              {data.counts.converted}
            </div>
          ) : undefined
        }
      />

      <AdminContent>
        <Tabs value={status} onValueChange={setStatus}>
          <TabsList>
            {STATUS_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="mt-4">
          <DataTable
            columns={columns}
            data={data?.items ?? []}
            isLoading={isLoading}
            rowHeight={64}
            emptyState={{
              icon: Sparkles,
              title: "暂无体验账号申请",
              description: "用户从登录页「一键体验演示展会」开通后会显示在这里",
            }}
          />
        </div>
      </AdminContent>

      <Dialog open={!!extendTarget} onOpenChange={() => setExtendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>延期体验账号</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              {extendTarget?.contactName ?? extendTarget?.user.name} · 当前到期{" "}
              {extendTarget
                ? format(new Date(extendTarget.expiresAt), "yyyy-MM-dd", {
                    locale: zhCN,
                  })
                : ""}
            </p>
            {extendTarget?.role === "PRIMARY" && (
              <p className="text-xs text-text-muted">
                主账号延期将同步其邀请的同事账号
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="extend-days">延长天数</Label>
              <Input
                id="extend-days"
                type="number"
                min={1}
                max={90}
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extend-notes">备注（选填）</Label>
              <Textarea
                id="extend-notes"
                value={extendNotes}
                onChange={(e) => setExtendNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExtendTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => void extendMutation.mutate()}
              disabled={extendMutation.isPending}
            >
              确认延期
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!convertTarget} onOpenChange={() => setConvertTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>审核通过并转正</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-muted">
              将按「组织申请」同一流程审核通过：为{" "}
              {convertTarget?.contactName ?? convertTarget?.user.name}{" "}
              创建正式组织、移除 Demo 权限，并发送邮件/短信通知。
            </p>
            <div className="space-y-2">
              <Label htmlFor="org-name">正式组织名称</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-notes">备注（选填）</Label>
              <Textarea
                id="convert-notes"
                value={convertNotes}
                onChange={(e) => setConvertNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => void convertMutation.mutate()}
              disabled={convertMutation.isPending || orgName.trim().length < 2}
            >
              确认转正
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
