"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiMeetingArea, ApiMeetingConfig } from "@/lib/meeting-config-service";

type MeetingAreaManagerProps = {
  eventId: string;
  areas: ApiMeetingArea[];
  config: ApiMeetingConfig | null;
  loading: boolean;
  onAreasChange: (areas: ApiMeetingArea[]) => void;
  onConfigRefresh: () => void;
};

export function MeetingAreaManager({
  eventId,
  areas,
  config,
  loading,
  onAreasChange,
  onConfigRefresh,
}: MeetingAreaManagerProps) {
  const [showAddArea, setShowAddArea] = useState(false);
  const [areaName, setAreaName] = useState("");
  const [areaLocation, setAreaLocation] = useState("");
  const [creatingArea, setCreatingArea] = useState(false);
  const [addingTableAreaId, setAddingTableAreaId] = useState<string | null>(null);

  const totalTables = areas.reduce((sum, a) => sum + a.tables.length, 0);

  const handleCreateArea = async () => {
    if (!areaName.trim()) {
      toast.error("请输入会面区名称");
      return;
    }
    setCreatingArea(true);
    try {
      const res = await fetch(`/api/events/${eventId}/meeting-areas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: areaName.trim(),
          location: areaLocation.trim() || null,
        }),
      });
      if (!res.ok) {
        toast.error("创建失败");
        return;
      }
      const json = await res.json();
      onAreasChange([...areas, json.data]);
      setAreaName("");
      setAreaLocation("");
      setShowAddArea(false);
      onConfigRefresh();
      toast.success("会面区已创建");
    } finally {
      setCreatingArea(false);
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    if (!confirm("删除会面区将同时移除其下所有桌位，确定继续？")) return;
    const res = await fetch(`/api/events/${eventId}/meeting-areas?id=${areaId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("删除失败");
      return;
    }
    onAreasChange(areas.filter((a) => a.id !== areaId));
    onConfigRefresh();
    toast.success("会面区已删除");
  };

  const handleAddTables = async (areaId: string, bulkCount?: number) => {
    setAddingTableAreaId(areaId);
    try {
      const res = await fetch(`/api/events/${eventId}/meeting-tables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          area_id: areaId,
          capacity: 2,
          ...(bulkCount ? { bulk_count: bulkCount } : {}),
        }),
      });
      if (!res.ok) {
        toast.error("添加桌位失败");
        return;
      }
      const json = await res.json();
      const newTables = json.data.tables as ApiMeetingArea["tables"];
      onAreasChange(
        areas.map((a) =>
          a.id === areaId ? { ...a, tables: [...a.tables, ...newTables] } : a,
        ),
      );
      onConfigRefresh();
      toast.success(bulkCount ? `已添加 ${bulkCount} 张桌位` : "桌位已添加");
    } finally {
      setAddingTableAreaId(null);
    }
  };

  const handleDeleteTable = async (areaId: string, tableId: string) => {
    const res = await fetch(`/api/events/${eventId}/meeting-tables?id=${tableId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      toast.error("删除失败");
      return;
    }
    onAreasChange(
      areas.map((a) =>
        a.id === areaId
          ? { ...a, tables: a.tables.filter((t) => t.id !== tableId) }
          : a,
      ),
    );
    onConfigRefresh();
  };

  return (
    <SectionCard
      title="会面区与桌位"
      description="配置物理会面区域与 1 对 1 桌位，供系统自动分配"
      action={
        <Button size="sm" variant="outline" onClick={() => setShowAddArea(true)}>
          <Plus className="mr-1 h-4 w-4" />
          新增会面区
        </Button>
      }
    >
      <div className="mb-4 flex flex-wrap gap-4 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <div>
          <span className="text-text-muted">总可用桌位</span>
          <p className="text-lg font-semibold text-text">{totalTables} 张</p>
        </div>
        <div>
          <span className="text-text-muted">预估日会面容量</span>
          <p className="text-lg font-semibold text-primary">
            {config?.daily_meeting_capacity ?? 0} 场/天
          </p>
        </div>
        {config && config.meeting_slot_minutes > 0 && (
          <div className="text-text-muted">
            按 {config.meeting_slot_minutes} 分钟/场 + {config.meeting_buffer_minutes}{" "}
            分钟缓冲计算
          </div>
        )}
      </div>

      {loading && areas.length === 0 ? (
        <p className="text-sm text-text-muted">加载会面区…</p>
      ) : areas.length === 0 ? (
        <div className="rounded-lg border border-border bg-muted/20 px-6 py-10 text-center">
          <LayoutGrid className="mx-auto h-10 w-10 text-text-tertiary" />
          <p className="mt-3 text-sm text-text-muted">尚未配置会面区</p>
          <Button className="mt-4" size="sm" onClick={() => setShowAddArea(true)}>
            创建第一个会面区
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {areas.map((area) => (
            <div
              key={area.id}
              className="rounded-lg border border-border bg-white shadow-sm"
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <h3 className="font-medium text-text">{area.name}</h3>
                  {area.location && (
                    <p className="mt-0.5 text-sm text-text-muted">{area.location}</p>
                  )}
                  <p className="mt-1 text-xs text-text-tertiary">
                    {area.tables.length} 张桌
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={addingTableAreaId === area.id}
                    onClick={() => handleAddTables(area.id)}
                  >
                    + 添加桌位
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={addingTableAreaId === area.id}
                    onClick={() => handleAddTables(area.id, 10)}
                  >
                    批量 10 桌
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => handleDeleteArea(area.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {area.tables.length > 0 ? (
                <div className="grid gap-2 p-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {area.tables.map((table) => (
                    <div
                      key={table.id}
                      className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium">{table.name}</span>
                        <span className="ml-2 text-xs text-text-muted">
                          {table.capacity} 人
                        </span>
                      </div>
                      <button
                        type="button"
                        className="text-text-tertiary hover:text-destructive"
                        onClick={() => handleDeleteTable(area.id, table.id)}
                        aria-label={`删除 ${table.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 py-6 text-center text-sm text-text-muted">
                  暂无桌位，请添加 1 对 1 洽谈桌
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddArea && (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
          <h4 className="mb-3 font-medium">新增会面区</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>区域名称</Label>
              <Input
                placeholder="洽谈区 A"
                value={areaName}
                onChange={(e) => setAreaName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>位置描述</Label>
              <Input
                placeholder="主馆 B 区东侧"
                value={areaLocation}
                onChange={(e) => setAreaLocation(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleCreateArea} disabled={creatingArea}>
              {creatingArea ? "创建中…" : "确认创建"}
            </Button>
            <Button variant="ghost" onClick={() => setShowAddArea(false)}>
              取消
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
