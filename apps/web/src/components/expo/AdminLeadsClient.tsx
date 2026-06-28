"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/components/admin/status-badge";

export type AdminLeadRow = {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  intent_level: string;
  booth_code: string;
  booth_company: string;
  crm_status: "SYNCED" | "PENDING" | "FAILED";
  captured_at: string;
};

async function fetchLeads(eventId: string): Promise<AdminLeadRow[]> {
  const res = await fetch(`/api/account/events/${eventId}/admin-leads?limit=100`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as AdminLeadRow[];
}

async function exportLeads(eventId: string) {
  const res = await fetch(`/api/account/events/${eventId}/admin-leads/export`, {
    method: "POST",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? json.message ?? "导出失败");
  }
  return (await res.json()).data as {
    task_id: string;
    status: string;
    lead_count: number;
    message: string;
  };
}

const CRM_LABEL: Record<AdminLeadRow["crm_status"], string> = {
  SYNCED: "已同步",
  PENDING: "待同步",
  FAILED: "失败",
};

export function AdminLeadsClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const [exporting, setExporting] = useState(false);

  const { data: leads = [], isLoading, isError } = useQuery({
    queryKey: ["admin-leads", eventId],
    queryFn: () => fetchLeads(eventId),
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await exportLeads(eventId);
      toast.success(
        result.message ||
          `导出任务已创建（${result.lead_count} 条线索）`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminPage>
      <AdminHeader
        title="全场线索"
        description={eventName}
        breadcrumb={["活动", "全场线索"]}
        actions={
          <Button
            className="bg-brand-blue text-white"
            disabled={exporting || leads.length === 0}
            onClick={() => void handleExport()}
          >
            <Download className="mr-1 size-4" />
            {exporting ? "提交中…" : "导出 MarketUP"}
          </Button>
        }
      />
      <AdminContent>
        <SectionCard
          id="hosted-buyer"
          title="已采集线索"
          description={
            isLoading
              ? "加载中…"
              : isError
                ? "加载失败，请刷新重试"
                : `${leads.length} 条 · 含展位、意向等级与 CRM 同步状态`
          }
        >
          <DataTable
            data={leads}
            getRowKey={(row) => row.id}
            emptyMessage="暂无线索"
            columns={[
              {
                key: "name",
                header: "访客",
                cell: (row) => row.name,
              },
              {
                key: "company",
                header: "公司 / 职位",
                cell: (row) =>
                  [row.company, row.title].filter(Boolean).join(" · ") || "—",
              },
              {
                key: "intent",
                header: "意向",
                cell: (row) => row.intent_level,
              },
              {
                key: "booth",
                header: "展位",
                cell: (row) => `${row.booth_code} · ${row.booth_company}`,
              },
              {
                key: "crm",
                header: "CRM",
                cell: (row) => CRM_LABEL[row.crm_status] ?? row.crm_status,
              },
              {
                key: "captured_at",
                header: "采集时间",
                cell: (row) => formatDateTime(new Date(row.captured_at)),
              },
            ]}
          />
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
