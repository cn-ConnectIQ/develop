"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminContent, AdminHeader, AdminPage, SectionCard } from "@/components/admin/admin-header";
import {
  CrmSyncStatusBadge,
  formatDateTime,
  LeadStatusBadge,
} from "@/components/admin/status-badge";
import { LeadDetailSheet } from "@/components/exhibitor/LeadDetailSheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ExhibitorLeadRow = {
  id: string;
  status: string;
  crmSyncStatus: string;
  crmSyncError: string | null;
  createdAt: string;
  participant: {
    name: string;
    company: string | null;
    email: string | null;
    phone: string | null;
  };
  intentTags: Array<{ intentTag: { label: string } }>;
};

type ExhibitorBoothLeadsClientProps = {
  boothId: string;
  boothCode: string;
  eventName: string;
  title: string;
  leads: ExhibitorLeadRow[];
};

export function ExhibitorBoothLeadsClient({
  boothId,
  boothCode,
  eventName,
  title,
  leads,
}: ExhibitorBoothLeadsClientProps) {
  const router = useRouter();
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  function openLead(leadId: string) {
    setSelectedLeadId(leadId);
    setSheetOpen(true);
  }

  return (
    <AdminPage>
      <AdminHeader
        title={title}
        description={`展位 ${boothCode} · ${eventName}`}
        breadcrumb={["线索管理", title]}
      />
      <AdminContent>
        <SectionCard
          title={`${title}（${leads.length}）`}
          description="点击行查看详情并更新跟进状态"
        >
          <div className="overflow-x-auto rounded-lg border border-border-light/60">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-10 bg-[#fafaf8] text-[12px] font-semibold text-text-muted">
                    访客
                  </TableHead>
                  <TableHead className="h-10 bg-[#fafaf8] text-[12px] font-semibold text-text-muted">
                    公司
                  </TableHead>
                  <TableHead className="h-10 bg-[#fafaf8] text-[12px] font-semibold text-text-muted">
                    邮箱
                  </TableHead>
                  <TableHead className="h-10 bg-[#fafaf8] text-[12px] font-semibold text-text-muted">
                    手机
                  </TableHead>
                  <TableHead className="h-10 bg-[#fafaf8] text-[12px] font-semibold text-text-muted">
                    状态
                  </TableHead>
                  <TableHead className="h-10 bg-[#fafaf8] text-[12px] font-semibold text-text-muted">
                    意向等级
                  </TableHead>
                  <TableHead className="h-10 bg-[#fafaf8] text-[12px] font-semibold text-text-muted">
                    MarketUP
                  </TableHead>
                  <TableHead className="h-10 bg-[#fafaf8] text-[12px] font-semibold text-text-muted">
                    创建时间
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="h-24 text-center text-[13px] text-text-tertiary"
                    >
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  leads.map((row) => (
                    <TableRow
                      key={row.id}
                      className={cn(
                        "admin-table-row cursor-pointer",
                        selectedLeadId === row.id && sheetOpen && "bg-brand-blue-light/20",
                      )}
                      onClick={() => openLead(row.id)}
                    >
                      <TableCell className="text-[13px]">{row.participant.name}</TableCell>
                      <TableCell className="text-[13px]">
                        {row.participant.company ?? "—"}
                      </TableCell>
                      <TableCell className="text-[13px]">
                        {row.participant.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-[13px]">
                        {row.participant.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-[13px]">
                        <LeadStatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="text-[13px]">
                        {row.intentTags.length > 0
                          ? row.intentTags.map((t) => t.intentTag.label).join("、")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-[13px]">
                        <CrmSyncStatusBadge
                          status={row.crmSyncStatus}
                          error={row.crmSyncError}
                        />
                      </TableCell>
                      <TableCell className="text-[13px]">
                        {formatDateTime(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </AdminContent>

      <LeadDetailSheet
        boothId={boothId}
        leadId={selectedLeadId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={() => router.refresh()}
      />
    </AdminPage>
  );
}
