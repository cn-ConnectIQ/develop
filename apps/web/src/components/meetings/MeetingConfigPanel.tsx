"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { ApiMeetingConfig, MeetingTimeWindow } from "@/lib/meeting-config-service";

const PRESET_WINDOWS: MeetingTimeWindow[] = [
  { start: "10:00", end: "12:00" },
  { start: "14:00", end: "17:00" },
];

const SLOT_OPTIONS = [15, 20, 30, 45] as const;
const BUFFER_OPTIONS = [5, 10] as const;

function formatOpenAt(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

function parseOpenMinutes(windows: MeetingTimeWindow[]): number {
  const parse = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  return windows.reduce((sum, w) => {
    const diff = parse(w.end) - parse(w.start);
    return sum + (diff > 0 ? diff : 0);
  }, 0);
}

type MeetingConfigPanelProps = {
  eventId: string;
  config: ApiMeetingConfig | null;
  loading: boolean;
  onSaved: (config: ApiMeetingConfig) => void;
};

export function MeetingConfigPanel({
  eventId,
  config,
  loading,
  onSaved,
}: MeetingConfigPanelProps) {
  const [enabled, setEnabled] = useState(true);
  const [slotMinutes, setSlotMinutes] = useState<number>(20);
  const [bufferMinutes, setBufferMinutes] = useState<number>(5);
  const [openAt, setOpenAt] = useState("");
  const [timeWindows, setTimeWindows] = useState<MeetingTimeWindow[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!config) return;
    setEnabled(config.meeting_enabled);
    setSlotMinutes(config.meeting_slot_minutes);
    setBufferMinutes(config.meeting_buffer_minutes);
    setOpenAt(formatOpenAt(config.meeting_open_at));
    setTimeWindows(config.time_windows.length > 0 ? config.time_windows : [...PRESET_WINDOWS]);
    setDirty(false);
  }, [config]);

  const capacityPreview = useMemo(() => {
    const tables = config?.total_tables ?? 0;
    const openMinutes = parseOpenMinutes(timeWindows);
    const block = Math.max(1, slotMinutes + bufferMinutes);
    const slotsPerTable = openMinutes > 0 ? Math.floor(openMinutes / block) : 0;
    return tables * slotsPerTable;
  }, [config?.total_tables, timeWindows, slotMinutes, bufferMinutes]);

  const markDirty = useCallback(() => setDirty(true), []);

  const toggleWindow = (window: MeetingTimeWindow) => {
    setTimeWindows((prev) => {
      const exists = prev.some((w) => w.start === window.start && w.end === window.end);
      if (exists) {
        return prev.filter((w) => !(w.start === window.start && w.end === window.end));
      }
      return [...prev, window].sort((a, b) => a.start.localeCompare(b.start));
    });
    markDirty();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}/meeting-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meeting_enabled: enabled,
          meeting_slot_minutes: slotMinutes,
          meeting_buffer_minutes: bufferMinutes,
          meeting_open_at: openAt ? new Date(openAt).toISOString() : null,
          time_windows: timeWindows,
        }),
      });
      if (!res.ok) {
        toast.error("保存失败");
        return;
      }
      const json = await res.json();
      toast.success("会面参数已保存");
      setDirty(false);
      onSaved(json.data);
    } finally {
      setSaving(false);
    }
  };

  if (loading && !config) {
    return (
      <SectionCard title="会面预约" description="加载中…">
        <p className="text-sm text-text-muted">正在加载配置…</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="会面预约"
        description="开启后，参会者可互相发起会面，系统自动排进日程并分配会面桌"
        action={
          dirty ? (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存参数"}
            </Button>
          ) : null
        }
      >
        <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 p-4">
          <div>
            <p className="font-medium text-text">开启会面预约</p>
            <p className="mt-1 text-sm text-text-muted">
              参会者可在小程序发起 1 对 1 会面，接受后自动分配桌位与时段
            </p>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={(v) => {
              setEnabled(v);
              markDirty();
            }}
          />
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>每场会面时长</Label>
            <Select
              value={String(slotMinutes)}
              onValueChange={(v) => {
                setSlotMinutes(Number(v));
                markDirty();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SLOT_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} 分钟
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>会面间缓冲时间</Label>
            <Select
              value={String(bufferMinutes)}
              onValueChange={(v) => {
                setBufferMinutes(Number(v));
                markDirty();
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BUFFER_OPTIONS.map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {m} 分钟
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>预约开放时间</Label>
            <Input
              type="datetime-local"
              value={openAt}
              onChange={(e) => {
                setOpenAt(e.target.value);
                markDirty();
              }}
            />
            <p className="text-xs text-text-muted">可设为活动前几天，用于会前预热预约</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="可约时段"
        description="设置每天开放会面的时间段，避开主议程；系统据此生成可预约时段网格"
      >
        <div className="flex flex-wrap gap-2">
          {PRESET_WINDOWS.map((w) => {
            const active = timeWindows.some(
              (tw) => tw.start === w.start && tw.end === w.end,
            );
            return (
              <button
                key={`${w.start}-${w.end}`}
                type="button"
                onClick={() => toggleWindow(w)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-white text-text-muted hover:border-primary/40"
                }`}
              >
                {w.start} – {w.end}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">自定义时段</Label>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                className="w-[120px]"
                id="custom-window-start"
                defaultValue="09:00"
              />
              <span className="text-text-muted">至</span>
              <Input
                type="time"
                className="w-[120px]"
                id="custom-window-end"
                defaultValue="18:00"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const startEl = document.getElementById(
                    "custom-window-start",
                  ) as HTMLInputElement | null;
                  const endEl = document.getElementById(
                    "custom-window-end",
                  ) as HTMLInputElement | null;
                  if (!startEl?.value || !endEl?.value) return;
                  if (startEl.value >= endEl.value) {
                    toast.error("结束时间须晚于开始时间");
                    return;
                  }
                  toggleWindow({ start: startEl.value, end: endEl.value });
                }}
              >
                <Plus className="mr-1 h-4 w-4" />
                添加
              </Button>
            </div>
          </div>
        </div>

        {timeWindows.length > 0 && (
          <ul className="mt-4 space-y-2">
            {timeWindows.map((w) => (
              <li
                key={`${w.start}-${w.end}`}
                className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm"
              >
                <span>
                  {w.start} – {w.end}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-text-muted"
                  onClick={() => toggleWindow(w)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-lg bg-muted/40 px-4 py-3 text-sm text-text-muted">
          当前配置下，{" "}
          <span className="font-medium text-text">{config?.total_tables ?? 0} 张桌</span>
          {parseOpenMinutes(timeWindows) > 0 && (
            <>
              {" "}
              × 开放{" "}
              {(parseOpenMinutes(timeWindows) / 60).toFixed(1).replace(/\.0$/, "")}{" "}
              小时 ÷ {slotMinutes + bufferMinutes} 分钟/场 ≈{" "}
              <span className="font-medium text-primary">{capacityPreview} 场/天</span>
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
