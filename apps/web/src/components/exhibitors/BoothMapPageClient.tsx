"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDot,
  Minus,
  Plus,
  Square,
  Trash2,
  Type,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoothMapTableView } from "@/components/exhibitors/BoothMapTableView";
import { ExhibitorCombobox } from "@/components/exhibitors/ExhibitorCombobox";
import {
  BOOTH_STATUS_DOT,
  BOOTH_STATUS_FILL,
  BOOTH_STATUS_STROKE,
  normalizeRect,
  pctFromEvent,
} from "@/lib/booth-map";
import type {
  BoothPosition,
  MapLabel,
  MapPoi,
  MapPoiType,
} from "@/types/booth";
import { POI_EMOJI, POI_TYPES } from "@/types/booth";
import { cn } from "@/lib/utils";

type BoothItem = {
  id: string;
  name: string;
  code: string;
  status: keyof typeof BOOTH_STATUS_FILL;
  positionData: BoothPosition | null;
  exhibitor: { id: string; name: string; email?: string | null };
  _count: { leads: number };
  stats: {
    todayVisitors: number;
    gradeA: number;
    crmSynced: number;
  };
};

type BoothMapData = {
  booths: BoothItem[];
  floorPlanUrl: string | null;
  pois: MapPoi[];
  labels: MapLabel[];
  exhibitors: Array<{ id: string; name: string; email?: string | null }>;
};

type Tool = "rect" | "poi" | "text" | "delete";

type PanelForm = {
  code: string;
  name: string;
  exhibitorId: string;
  area: string;
  status: BoothItem["status"];
};

async function fetchBoothMap(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/booths`);
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return json.data as BoothMapData;
}

export function BoothMapPageClient({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawStartRef = useRef<{ x: number; y: number } | null>(null);
  const justDrawnRef = useRef(false);

  const [tool, setTool] = useState<Tool>("rect");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [tableView, setTableView] = useState(false);
  const [draftRect, setDraftRect] = useState<BoothPosition | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [poiTypeIndex, setPoiTypeIndex] = useState(0);
  const [localPois, setLocalPois] = useState<MapPoi[]>([]);
  const [localLabels, setLocalLabels] = useState<MapLabel[]>([]);
  const [panelForm, setPanelForm] = useState<PanelForm>({
    code: "",
    name: "",
    exhibitorId: "",
    area: "",
    status: "AVAILABLE",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["booth-map", eventId],
    queryFn: () => fetchBoothMap(eventId),
  });

  useEffect(() => {
    if (data?.pois) setLocalPois(data.pois);
    if (data?.labels) setLocalLabels(data.labels);
  }, [data?.pois, data?.labels]);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["booth-map", eventId] });

  const updateBooth = useMutation({
    mutationFn: async (payload: {
      boothId: string;
      data: Record<string, unknown>;
    }) => {
      const res = await fetch(
        `/api/events/${eventId}/booths/${payload.boothId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload.data),
        },
      );
      if (!res.ok) throw new Error("保存失败");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success("已保存");
    },
    onError: () => toast.error("保存失败"),
  });

  const createBooth = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/events/${eventId}/booths`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("创建失败");
      return res.json();
    },
    onSuccess: (json) => {
      invalidate();
      setSelectedId(json.data.id);
      toast.success("展位已创建");
    },
    onError: () => toast.error("创建展位失败"),
  });

  const deleteBooth = useMutation({
    mutationFn: async (boothId: string) => {
      const res = await fetch(`/api/events/${eventId}/booths/${boothId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      return res.json();
    },
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
      toast.success("展位已删除");
    },
    onError: () => toast.error("删除失败"),
  });

  const uploadFloorPlan = useMutation({
    mutationFn: async (url: string) => {
      const res = await fetch(`/api/events/${eventId}/booths`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floorPlanUrl: url }),
      });
      if (!res.ok) throw new Error("上传失败");
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast.success("平面图已更新");
    },
    onError: () => toast.error("上传失败"),
  });

  const saveMapOverlay = useMutation({
    mutationFn: async (payload: { pois?: MapPoi[]; labels?: MapLabel[] }) => {
      const res = await fetch(`/api/events/${eventId}/booths`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("保存失败");
      return res.json();
    },
    onSuccess: () => invalidate(),
  });

  const selected = useMemo(
    () => data?.booths.find((b) => b.id === selectedId) ?? null,
    [data?.booths, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setPanelForm({
      code: selected.code,
      name: selected.name,
      exhibitorId: selected.exhibitor.id,
      area: selected.positionData?.area?.toString() ?? "",
      status: selected.status,
    });
  }, [selected]);

  const getCanvasRect = useCallback(() => {
    return canvasRef.current?.getBoundingClientRect() ?? null;
  }, []);

  const finishRectDraw = useCallback(
    (rect: BoothPosition) => {
      const count = (data?.booths.length ?? 0) + 1;
      const code = `B${String(count).padStart(2, "0")}`;
      justDrawnRef.current = true;
      createBooth.mutate({
        name: `展位 ${code}`,
        code,
        status: "AVAILABLE",
        positionData: rect,
      });
      setDraftRect(null);
      drawStartRef.current = null;
      setIsDrawing(false);
    },
    [createBooth, data?.booths.length],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (tool !== "rect" || !canvasRef.current) return;
      e.preventDefault();
      const rect = getCanvasRect();
      if (!rect) return;
      const point = pctFromEvent(e, rect);
      drawStartRef.current = point;
      setIsDrawing(true);
      setDraftRect({ ...point, width: 0, height: 0 });
    },
    [tool, getCanvasRect],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDrawing || !drawStartRef.current) return;
      const rect = getCanvasRect();
      if (!rect) return;
      const point = pctFromEvent(e, rect);
      setDraftRect(normalizeRect(drawStartRef.current, point));
    },
    [isDrawing, getCanvasRect],
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !draftRect) return;
    if (draftRect.width >= 2 && draftRect.height >= 2) {
      finishRectDraw(draftRect);
    } else {
      setDraftRect(null);
      drawStartRef.current = null;
      setIsDrawing(false);
    }
  }, [isDrawing, draftRect, finishRectDraw]);

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (justDrawnRef.current) {
        justDrawnRef.current = false;
        return;
      }
      if (isDrawing) return;
      const rect = getCanvasRect();
      if (!rect) return;
      const point = pctFromEvent(e, rect);

      if (tool === "poi") {
        const type = POI_TYPES[poiTypeIndex % POI_TYPES.length] as MapPoiType;
        setPoiTypeIndex((i) => i + 1);
        const newPoi: MapPoi = {
          id: crypto.randomUUID(),
          type,
          x: point.x,
          y: point.y,
        };
        const next = [...localPois, newPoi];
        setLocalPois(next);
        saveMapOverlay.mutate({ pois: next });
        return;
      }

      if (tool === "text") {
        const text = window.prompt("输入标注文字", "入口");
        if (!text?.trim()) return;
        const newLabel: MapLabel = {
          id: crypto.randomUUID(),
          text: text.trim(),
          x: point.x,
          y: point.y,
        };
        const next = [...localLabels, newLabel];
        setLocalLabels(next);
        saveMapOverlay.mutate({ labels: next });
        return;
      }

      if (tool === "delete") {
        if (selectedId) {
          deleteBooth.mutate(selectedId);
        } else if (selectedPoiId) {
          const next = localPois.filter((p) => p.id !== selectedPoiId);
          setLocalPois(next);
          setSelectedPoiId(null);
          saveMapOverlay.mutate({ pois: next });
        }
      }
    },
    [
      isDrawing,
      tool,
      getCanvasRect,
      poiTypeIndex,
      localPois,
      localLabels,
      saveMapOverlay,
      selectedId,
      selectedPoiId,
      deleteBooth,
    ],
  );

  const handleFileUpload = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("请上传 PNG 或 JPG 图片");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        uploadFloorPlan.mutate(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSavePanel = () => {
    if (!selected) return;
    const area = panelForm.area ? Number(panelForm.area) : undefined;
    const positionData = selected.positionData
      ? {
          ...selected.positionData,
          ...(area != null && !Number.isNaN(area) ? { area } : {}),
        }
      : area != null && !Number.isNaN(area)
        ? { x: 0, y: 0, width: 8, height: 6, area }
        : undefined;

    const status =
      panelForm.exhibitorId && selected.status === "AVAILABLE"
        ? "BOOKED"
        : panelForm.status;

    updateBooth.mutate({
      boothId: selected.id,
      data: {
        code: panelForm.code,
        name: panelForm.name || panelForm.code,
        exhibitorId: panelForm.exhibitorId,
        status,
        ...(positionData ? { positionData } : {}),
      },
    });
  };

  const handleFitScreen = () => setZoom(1);

  if (tableView) {
    return (
      <BoothMapTableView
        booths={data?.booths ?? []}
        onBack={() => setTableView(false)}
      />
    );
  }

  return (
    <div className="-m-6 flex h-[calc(100vh-56px)] overflow-hidden">
      <aside className="w-64 shrink-0 border-r border-border-light bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold">展位地图</h2>
        <Tabs defaultValue="tools">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="tools" className="flex-1 text-xs">
              绘制工具
            </TabsTrigger>
            <TabsTrigger value="list" className="flex-1 text-xs">
              展商列表
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tools" className="mt-0">
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["rect", Square, "矩形绘制"],
                  ["poi", CircleDot, "圆形 POI"],
                  ["text", Type, "文字标注"],
                  ["delete", Trash2, "删除"],
                ] as const
              ).map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTool(key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-xs transition-colors",
                    tool === key
                      ? "border-brand-blue bg-brand-blue-light text-brand-blue"
                      : "border-border-light hover:border-brand-blue/40",
                  )}
                >
                  <Icon className="size-6" />
                  {label}
                </button>
              ))}
            </div>
            {tool === "poi" && (
              <p className="mt-3 text-xs text-text-muted">
                点击画布放置 POI，当前：{" "}
                {POI_EMOJI[POI_TYPES[poiTypeIndex % POI_TYPES.length]!]}
              </p>
            )}
            {tool === "delete" && (
              <p className="mt-3 text-xs text-brand-amber">
                选中展位或 POI 后点击画布删除
              </p>
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            <ul className="max-h-[calc(100vh-220px)] space-y-1 overflow-y-auto">
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <li
                    key={i}
                    className="h-12 animate-pulse rounded-lg bg-gray-100"
                  />
                ))}
              {data?.booths.map((booth) => (
                <li key={booth.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(booth.id);
                      setSelectedPoiId(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                      selectedId === booth.id
                        ? "border-brand-blue bg-brand-blue-light"
                        : "border-border-light hover:bg-gray-50",
                    )}
                  >
                    <span
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        BOOTH_STATUS_DOT[booth.status],
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-brand-blue">
                        {booth.code}
                      </span>
                      <span className="ml-2 truncate text-text-muted">
                        {booth.exhibitor.name}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
              {!isLoading && data?.booths.length === 0 && (
                <li className="py-6 text-center text-xs text-text-muted">
                  暂无展位，使用矩形工具绘制
                </li>
              )}
            </ul>
          </TabsContent>
        </Tabs>
      </aside>

      <div className="relative flex-1 bg-gray-50">
        <div className="absolute top-4 right-4 z-20">
          <Button variant="outline" size="sm" onClick={() => setTableView(true)}>
            表格视图
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />

        {!data?.floorPlanUrl && !isLoading && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="absolute inset-8 z-10 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-light bg-white transition-colors hover:border-brand-blue/50 hover:bg-brand-blue-light/30"
          >
            <Upload className="mb-3 size-10 text-text-tertiary" />
            <span className="text-sm text-text-muted">
              点击上传场馆平面图（PNG/JPG）
            </span>
          </button>
        )}

        <div
          ref={canvasRef}
          className={cn(
            "absolute inset-0 overflow-hidden",
            tool === "rect" && "cursor-crosshair",
            (tool === "poi" || tool === "text") && "cursor-copy",
            tool === "delete" && "cursor-not-allowed",
          )}
          style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
        >
          {data?.floorPlanUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.floorPlanUrl}
              alt="场馆平面图"
              className="pointer-events-none absolute inset-0 size-full object-contain"
              draggable={false}
            />
          )}

          <svg className="absolute inset-0 size-full">
            {data?.booths.map((booth) => {
              const pos = booth.positionData;
              if (!pos) return null;
              const isSelected = booth.id === selectedId;
              const fill = BOOTH_STATUS_FILL[booth.status];
              const stroke = BOOTH_STATUS_STROKE[booth.status];
              const isAvailable = booth.status === "AVAILABLE";

              return (
                <g
                  key={booth.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tool === "delete") {
                      deleteBooth.mutate(booth.id);
                      return;
                    }
                    setSelectedId(booth.id);
                    setSelectedPoiId(null);
                  }}
                  className="cursor-pointer"
                >
                  <rect
                    x={`${pos.x}%`}
                    y={`${pos.y}%`}
                    width={`${pos.width}%`}
                    height={`${pos.height}%`}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isSelected ? 3 : 1}
                    strokeDasharray={isAvailable ? "4" : undefined}
                    rx={4}
                  />
                  <text
                    x={`${pos.x + pos.width / 2}%`}
                    y={`${pos.y + pos.height / 2 - (booth.status === "OCCUPIED" ? 1.2 : 0)}%`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="fill-[#1A1A2E] text-[10px] font-semibold"
                    pointerEvents="none"
                  >
                    {booth.code}
                  </text>
                  {booth.status === "OCCUPIED" && (
                    <text
                      x={`${pos.x + pos.width / 2}%`}
                      y={`${pos.y + pos.height / 2 + 2}%`}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-text-muted text-[8px]"
                      pointerEvents="none"
                    >
                      {booth.exhibitor.name}
                    </text>
                  )}
                </g>
              );
            })}

            {draftRect && (
              <rect
                x={`${draftRect.x}%`}
                y={`${draftRect.y}%`}
                width={`${draftRect.width}%`}
                height={`${draftRect.height}%`}
                fill="#E6F1FB80"
                stroke="#185FA5"
                strokeDasharray="4"
                rx={4}
              />
            )}

            {localPois.map((poi) => (
              <g
                key={poi.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (tool === "delete") {
                    const next = localPois.filter((p) => p.id !== poi.id);
                    setLocalPois(next);
                    saveMapOverlay.mutate({ pois: next });
                    return;
                  }
                  setSelectedPoiId(poi.id);
                  setSelectedId(null);
                }}
                className="cursor-pointer"
              >
                <foreignObject
                  x={`${poi.x - 1.5}%`}
                  y={`${poi.y - 1.5}%`}
                  width="3%"
                  height="3%"
                >
                  <div className="flex size-full items-center justify-center text-base leading-none">
                    {POI_EMOJI[poi.type]}
                  </div>
                </foreignObject>
              </g>
            ))}

            {localLabels.map((label) => (
              <text
                key={label.id}
                x={`${label.x}%`}
                y={`${label.y}%`}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-[#1A1A2E] text-[11px] font-medium"
                pointerEvents="none"
              >
                {label.text}
              </text>
            ))}
          </svg>
        </div>

        {selected && (
          <div className="absolute top-16 right-4 z-20 w-52 rounded-xl bg-white p-4 shadow-lg">
            <p className="mb-3 text-sm font-semibold">展位属性</p>
            <Label className="text-xs text-text-muted">展位编号</Label>
            <Input
              className="mt-1 mb-3 h-8"
              value={panelForm.code}
              onChange={(e) =>
                setPanelForm((f) => ({ ...f, code: e.target.value }))
              }
            />
            <Label className="text-xs text-text-muted">分配展商</Label>
            <ExhibitorCombobox
              exhibitors={data?.exhibitors ?? []}
              value={panelForm.exhibitorId}
              onChange={(exhibitorId) =>
                setPanelForm((f) => ({ ...f, exhibitorId }))
              }
            />
            <Label className="mt-3 text-xs text-text-muted">展位面积（㎡，可选）</Label>
            <Input
              className="mt-1 mb-4 h-8"
              type="number"
              min={0}
              placeholder="例如 18"
              value={panelForm.area}
              onChange={(e) =>
                setPanelForm((f) => ({ ...f, area: e.target.value }))
              }
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-brand-blue hover:bg-brand-blue/90"
                onClick={handleSavePanel}
                disabled={updateBooth.isPending}
              >
                保存
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => deleteBooth.mutate(selected.id)}
                disabled={deleteBooth.isPending}
              >
                删除
              </Button>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border-light bg-white px-2 py-1 shadow-md">
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="size-8"
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))}
          >
            <Plus className="size-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-xs" onClick={handleFitScreen}>
            适应屏幕
          </Button>
        </div>

        {data?.floorPlanUrl && (
          <Button
            size="sm"
            variant="outline"
            className="absolute bottom-4 right-4 z-20 text-xs"
            onClick={() => fileInputRef.current?.click()}
          >
            更换平面图
          </Button>
        )}
      </div>
    </div>
  );
}
