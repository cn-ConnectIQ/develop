"use client";

import { SectionCard } from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";

export type EventTicketTypeRow = {
  id: string;
  name: string;
  price: number;
  quota: number | null;
  soldCount: number;
};

export function EventTicketsPanel({ ticketTypes }: { ticketTypes: EventTicketTypeRow[] }) {
  return (
    <SectionCard title="票种列表" description="活动票种与已售数量">
      <DataTable
        data={ticketTypes}
        getRowKey={(row) => row.id}
        emptyMessage="暂无票种，可在百格或报名渠道配置后同步至本活动"
        columns={[
          { key: "name", header: "票种名称", cell: (row) => row.name },
          {
            key: "price",
            header: "价格",
            cell: (row) => `¥${row.price.toFixed(2)}`,
          },
          {
            key: "quota",
            header: "配额",
            cell: (row) => (row.quota != null ? String(row.quota) : "不限"),
          },
          {
            key: "sold",
            header: "已售",
            cell: (row) => row.soldCount,
          },
        ]}
      />
    </SectionCard>
  );
}
