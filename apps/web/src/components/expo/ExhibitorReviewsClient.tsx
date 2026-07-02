"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";

export type ExhibitorReviewRow = {
  id: string;
  company_name: string;
  booth_code: string;
  booth_name: string;
  status: string;
};

async function fetchReviews(eventId: string): Promise<ExhibitorReviewRow[]> {
  const res = await fetch(`/api/account/events/${eventId}/exhibitor-reviews`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as ExhibitorReviewRow[];
}

async function submitReview(
  eventId: string,
  boothId: string,
  action: "approve" | "reject",
) {
  const res = await fetch(`/api/account/events/${eventId}/exhibitor-reviews`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booth_id: boothId, action }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? json.message ?? "操作失败");
  }
}

export function ExhibitorReviewsClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const [actingId, setActingId] = useState<string | null>(null);

  const { data: items = [], isLoading, isError } = useQuery({
    queryKey: ["exhibitor-reviews", eventId],
    queryFn: () => fetchReviews(eventId),
  });

  const handleReview = useCallback(
    async (boothId: string, action: "approve" | "reject") => {
      setActingId(boothId);
      try {
        await submitReview(eventId, boothId, action);
        toast.success(action === "approve" ? "已通过展商申请" : "已驳回展商申请");
        void queryClient.invalidateQueries({ queryKey: ["exhibitor-reviews", eventId] });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "操作失败");
      } finally {
        setActingId(null);
      }
    },
    [eventId, queryClient],
  );

  return (
    <AdminPage>
      <AdminHeader
        title="展商审核"
        description={eventName}
        breadcrumb={["活动", "展商审核"]}
      />
      <AdminContent>
        <SectionCard
          title="待审核展商"
          description={
            isLoading
              ? "加载中…"
              : isError
                ? "加载失败，请刷新重试"
                : `${items.length} 条待处理申请`
          }
        >
          <DataTable
            data={items}
            getRowKey={(row) => row.id}
            emptyMessage="暂无待审核展商"
            columns={[
              {
                key: "company",
                header: "展商",
                cell: (row) => row.company_name,
              },
              {
                key: "booth",
                header: "展位",
                cell: (row) => `${row.booth_code} · ${row.booth_name}`,
              },
              {
                key: "status",
                header: "状态",
                cell: (row) =>
                  row.status === "PENDING" ? (
                    <span className="admin-badge-soft-amber">待审核</span>
                  ) : (
                    row.status
                  ),
              },
              {
                key: "actions",
                header: "操作",
                className: "text-right",
                cell: (row) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      className="bg-brand-green text-white hover:bg-brand-green/90"
                      disabled={actingId === row.id}
                      onClick={() => void handleReview(row.id, "approve")}
                    >
                      <Check className="mr-1 size-4" />
                      通过
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === row.id}
                      onClick={() => void handleReview(row.id, "reject")}
                    >
                      <X className="mr-1 size-4" />
                      驳回
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
