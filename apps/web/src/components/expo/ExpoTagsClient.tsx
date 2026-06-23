"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/admin/admin-header";
import { DataTable } from "@/components/admin/data-table";
import { Button } from "@/components/ui/button";

type TagRow = {
  id: string;
  label: string;
  slug: string;
  category: string | null;
  color: string | null;
  sortOrder: number;
};

async function fetchTags(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/intent-tags`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.tags as TagRow[];
}

export function ExpoTagsClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const queryClient = useQueryClient();
  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["event-intent-tags", eventId],
    queryFn: () => fetchTags(eventId),
  });

  async function copyFromPlatform() {
    const res = await fetch(`/api/events/${eventId}/intent-tags`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "copy_platform" }),
    });
    if (!res.ok) {
      toast.error("复制失败");
      return;
    }
    const json = await res.json();
    toast.success(`已从平台模板复制 ${json.data.copied} 个标签`);
    void queryClient.invalidateQueries({
      queryKey: ["event-intent-tags", eventId],
    });
  }

  return (
    <SectionCard
      title={`标签列表（${tags.length}）`}
      description={`${eventName} · 用于标记访客意向`}
      action={
        <Button variant="outline" size="sm" onClick={() => void copyFromPlatform()}>
          从平台模板复制
        </Button>
      }
    >
      {isLoading ? (
        <p className="py-8 text-center text-sm text-text-muted">加载中...</p>
      ) : (
        <DataTable
          data={tags}
          getRowKey={(row) => row.id}
          columns={[
            { key: "label", header: "标签", cell: (row) => row.label },
            { key: "slug", header: "Slug", cell: (row) => row.slug },
            {
              key: "category",
              header: "分类",
              cell: (row) => row.category ?? "—",
            },
          ]}
        />
      )}
    </SectionCard>
  );
}
