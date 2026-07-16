"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { NotificationWizardClient } from "@/components/notifications/NotificationWizardClient";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusChip } from "@/components/ui/status-chip";

type JobRow = {
  id: string;
  templateCode: string;
  status: string;
  totalCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
  template: { name: string; channel: string } | null;
  createdBy: { id: string; name: string | null } | null;
  variableOverrides?: Record<string, unknown> | null;
};

function statusChip(status: string) {
  switch (status) {
    case "DONE":
      return <StatusChip variant="success">已发送</StatusChip>;
    case "SENDING":
      return <StatusChip variant="info">发送中</StatusChip>;
    case "SCHEDULED":
      return <StatusChip variant="info">已排期</StatusChip>;
    case "FAILED":
      return <StatusChip variant="danger">失败</StatusChip>;
    default:
      return <StatusChip variant="neutral">{status}</StatusChip>;
  }
}

function snippetOf(job: JobRow) {
  const overrides = job.variableOverrides ?? {};
  const content = overrides["内容"];
  if (typeof content === "string" && content.trim()) {
    return content.length > 60 ? `${content.slice(0, 60)}…` : content;
  }
  return job.template?.name ?? job.templateCode;
}

export function NotificationManagementClient({
  eventId,
}: {
  eventId: string;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState(
    tabParam === "compose" ? "compose" : "records",
  );
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${eventId}/notifications/jobs`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "加载通知记录失败");
        return;
      }
      setJobs((json.data ?? []) as JobRow[]);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (tabParam === "compose") setActiveTab("compose");
  }, [tabParam]);

  useEffect(() => {
    if (activeTab === "records") void loadJobs();
  }, [activeTab, loadJobs]);

  return (
    <AdminPageBody>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--admin-ink)]">通知管理</h1>
          <p className="mt-1 text-sm text-text-muted">
            自定义短信/邮件群发；查看历史通知与送达情况（额度按主办方账号扣除）
          </p>
        </div>
        {activeTab === "records" && (
          <Button onClick={() => setActiveTab("compose")}>发起新通知</Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="records">通知记录</TabsTrigger>
          <TabsTrigger value="compose">发起通知</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="mt-4">
          <div className="overflow-hidden rounded-xl border border-border-light bg-white">
            {loading ? (
              <p className="p-6 text-sm text-text-muted">加载中…</p>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-start gap-3 p-6">
                <p className="text-sm text-text-muted">暂无通知记录</p>
                <Button onClick={() => setActiveTab("compose")}>
                  发起第一条通知
                </Button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-border-light bg-content/50 text-left text-xs text-text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">内容摘要</th>
                    <th className="px-4 py-3 font-medium">渠道</th>
                    <th className="px-4 py-3 font-medium">状态</th>
                    <th className="px-4 py-3 font-medium">送达</th>
                    <th className="px-4 py-3 font-medium">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b border-border-light last:border-0"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--admin-ink)]">
                          {snippetOf(job)}
                        </p>
                        <p className="mt-0.5 text-xs text-text-muted">
                          {job.createdBy?.name ?? "—"} · {job.templateCode}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-text-muted">
                        {job.template?.channel === "SMS"
                          ? "短信"
                          : job.template?.channel === "EMAIL"
                            ? "邮件"
                            : (job.template?.channel ?? "—")}
                      </td>
                      <td className="px-4 py-3">{statusChip(job.status)}</td>
                      <td className="px-4 py-3 tabular-nums text-text-muted">
                        {job.sentCount}/{job.totalCount}
                        {job.failedCount > 0 ? (
                          <span className="text-brand-red">
                            {" "}
                            · 失败 {job.failedCount}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-xs text-text-muted">
                        {new Date(job.createdAt).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compose" className="mt-4">
          <NotificationWizardClient
            eventId={eventId}
            embedded
            onFinished={() => {
              setActiveTab("records");
              void loadJobs();
            }}
          />
        </TabsContent>
      </Tabs>
    </AdminPageBody>
  );
}
