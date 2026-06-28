"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { SectionCard } from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  eventCategoryOptions,
  type EventCategory,
} from "@/lib/event-utils";
import { cn } from "@/lib/utils";

type EventDetail = {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  category: EventCategory | null;
  review?: { status: string } | null;
};

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocation(location: string | null): { city: string; venue: string } {
  if (!location) return { city: "", venue: "" };
  const parts = location.split(" · ");
  if (parts.length >= 2) {
    return { city: parts[0] ?? "", venue: parts.slice(1).join(" · ") };
  }
  return { city: "", venue: location };
}

async function fetchEvent(eventId: string): Promise<EventDetail> {
  const res = await fetch(`/api/events/${eventId}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as EventDetail;
}

export function EventGeneralSettingsForm({ eventId }: { eventId: string }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: () => fetchEvent(eventId),
  });

  const [name, setName] = useState("");
  const [category, setCategory] = useState<EventCategory>("SUMMIT");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!data) return;
    const loc = parseLocation(data.location);
    setName(data.name);
    setCategory(data.category ?? "SUMMIT");
    setStartDate(toDatetimeLocal(data.startDate));
    setEndDate(toDatetimeLocal(data.endDate));
    setCity(loc.city);
    setVenue(loc.venue);
    setDescription(data.description ?? "");
    setDirty(false);
  }, [data]);

  const isLocked = data?.review?.status === "PENDING_REVIEW";

  const markDirty = () => setDirty(true);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("请填写活动名称");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("请填写开始和结束时间");
      return;
    }
    if (new Date(endDate) <= new Date(startDate)) {
      toast.error("结束时间须晚于开始时间");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          startDate: new Date(startDate).toISOString(),
          endDate: new Date(endDate).toISOString(),
          city: city.trim() || undefined,
          venue: venue.trim() || undefined,
          description: description.trim(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "保存失败");
        return;
      }
      toast.success("基本信息已保存");
      setDirty(false);
      void queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["event-dashboard", eventId] });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SectionCard title="基本信息">
        <p className="text-sm text-text-muted">加载中…</p>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="基本信息"
      description="活动名称、时间、地点与描述。保存后若处于修订状态，将回到草稿待提交审核。"
    >
      {isLocked && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          活动正在平台审核中，暂不可修改基本信息。
        </p>
      )}

      <div className="space-y-4">
        <div>
          <Label htmlFor="event-name">活动名称</Label>
          <Input
            id="event-name"
            value={name}
            disabled={isLocked}
            onChange={(e) => {
              setName(e.target.value);
              markDirty();
            }}
          />
        </div>

        <div>
          <Label>活动类型</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {eventCategoryOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={isLocked}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm transition-colors",
                  category === opt.value
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-border-light hover:bg-muted/50",
                )}
                onClick={() => {
                  setCategory(opt.value);
                  markDirty();
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="start-date">开始时间</Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={startDate}
              disabled={isLocked}
              onChange={(e) => {
                setStartDate(e.target.value);
                markDirty();
              }}
            />
          </div>
          <div>
            <Label htmlFor="end-date">结束时间</Label>
            <Input
              id="end-date"
              type="datetime-local"
              value={endDate}
              disabled={isLocked}
              onChange={(e) => {
                setEndDate(e.target.value);
                markDirty();
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="city">城市</Label>
            <Input
              id="city"
              value={city}
              disabled={isLocked}
              placeholder="如：上海"
              onChange={(e) => {
                setCity(e.target.value);
                markDirty();
              }}
            />
          </div>
          <div>
            <Label htmlFor="venue">场馆 / 地址</Label>
            <Input
              id="venue"
              value={venue}
              disabled={isLocked}
              placeholder="如：国家会展中心"
              onChange={(e) => {
                setVenue(e.target.value);
                markDirty();
              }}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="description">活动描述</Label>
          <Textarea
            id="description"
            rows={4}
            value={description}
            disabled={isLocked}
            placeholder="简要介绍活动亮点与目标受众…"
            onChange={(e) => {
              setDescription(e.target.value);
              markDirty();
            }}
          />
        </div>

        <div className="flex justify-end">
          <Button
            onClick={() => void handleSave()}
            disabled={!dirty || saving || isLocked}
          >
            {saving ? "保存中…" : "保存基本信息"}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
