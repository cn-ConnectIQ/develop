"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { ApiStampRally } from "@/lib/stamp-rally-service";

export type BoothOption = {
  id: string;
  code: string;
  name: string;
  companyOrg: { id: string; name: string };
};

type StampRallyConfigSheetProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booths: BoothOption[];
  editRally?: ApiStampRally | null;
  onSuccess: () => void;
};

export function StampRallyConfigSheet({
  eventId,
  open,
  onOpenChange,
  booths,
  editRally,
  onSuccess,
}: StampRallyConfigSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [prize, setPrize] = useState("");
  const [prizeImageUrl, setPrizeImageUrl] = useState<string | null>(null);
  const [requiredCount, setRequiredCount] = useState(3);
  const [selectedBoothIds, setSelectedBoothIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editRally) {
      setName(editRally.name);
      setDescription(editRally.description ?? "");
      setPrize(editRally.prize);
      setPrizeImageUrl(editRally.prize_image_url);
      setRequiredCount(editRally.required_count);
      setSelectedBoothIds(editRally.booth_ids);
      setStartsAt(
        editRally.starts_at
          ? editRally.starts_at.slice(0, 16)
          : "",
      );
      setEndsAt(
        editRally.ends_at ? editRally.ends_at.slice(0, 16) : "",
      );
    } else {
      setName("");
      setDescription("");
      setPrize("");
      setPrizeImageUrl(null);
      setRequiredCount(Math.min(3, booths.length || 3));
      setSelectedBoothIds([]);
      setStartsAt("");
      setEndsAt("");
    }
  }, [open, editRally, booths.length]);

  const maxStamps = selectedBoothIds.length || booths.length;

  const payload = useMemo(
    () => ({
      name,
      description: description || null,
      prize,
      prize_image_url: prizeImageUrl,
      required_count: Math.min(requiredCount, maxStamps || requiredCount),
      booth_ids: selectedBoothIds,
      starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      ends_at: endsAt ? new Date(endsAt).toISOString() : null,
    }),
    [
      name,
      description,
      prize,
      prizeImageUrl,
      requiredCount,
      selectedBoothIds,
      startsAt,
      endsAt,
      maxStamps,
    ],
  );

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "上传失败");
      setPrizeImageUrl(json.data?.url ?? json.url);
      toast.success("图片上传成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function submit(status: "DRAFT" | "ACTIVE") {
    if (!name.trim() || !prize.trim()) {
      toast.error("请填写路线名称和奖励描述");
      return;
    }
    if (selectedBoothIds.length === 0) {
      toast.error("请至少选择一个参与展位");
      return;
    }
    if (requiredCount < 1 || requiredCount > selectedBoothIds.length) {
      toast.error("所需章数不能超过已选展位数");
      return;
    }

    setSaving(true);
    try {
      const url = editRally
        ? `/api/events/${eventId}/stamp-rallies/${editRally.id}`
        : `/api/events/${eventId}/stamp-rallies`;
      const res = await fetch(url, {
        method: editRally ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失败");
      toast.success(status === "ACTIVE" ? "集章路线已开始" : "草稿已保存");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function toggleBooth(id: string) {
    setSelectedBoothIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle>{editRally ? "配置集章路线" : "创建集章路线"}</SheetTitle>
          <SheetDescription>
            选择参与展位，设置集章数量与兑换奖励
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label>路线名称</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="2025 展会集章之旅"
            />
          </div>

          <div className="space-y-2">
            <Label>奖励描述</Label>
            <Input
              value={prize}
              onChange={(e) => setPrize(e.target.value)}
              placeholder="集齐 5 个章即可兑换 AirPods Pro"
            />
          </div>

          <div className="space-y-2">
            <Label>奖励图片</Label>
            <div className="flex items-center gap-3">
              {prizeImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={prizeImageUrl}
                  alt="奖励"
                  className="size-16 rounded-lg border border-border-light object-cover"
                />
              )}
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                  }}
                />
                <span className="inline-flex h-9 items-center gap-2 rounded-lg border border-border-light px-3 text-sm text-brand-blue hover:bg-brand-blue-light">
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  上传图片
                </span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              所需章数（1 – {maxStamps || "?"})
            </Label>
            <Input
              type="number"
              min={1}
              max={maxStamps || undefined}
              value={requiredCount}
              onChange={(e) => setRequiredCount(Number(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>参与展位</Label>
              <span className="text-xs text-text-muted">
                已选 {selectedBoothIds.length} 个展位
              </span>
            </div>
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border-light">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-content">
                  <tr className="border-b border-border-light text-left text-text-muted">
                    <th className="w-10 p-2" />
                    <th className="p-2">展位号</th>
                    <th className="p-2">公司名</th>
                  </tr>
                </thead>
                <tbody>
                  {booths.map((booth) => (
                    <tr
                      key={booth.id}
                      className="border-b border-border-light last:border-0"
                    >
                      <td className="p-2">
                        <Checkbox
                          checked={selectedBoothIds.includes(booth.id)}
                          onCheckedChange={() => toggleBooth(booth.id)}
                        />
                      </td>
                      <td className="p-2 font-medium">{booth.code}</td>
                      <td className="p-2 text-text-muted">
                        {booth.companyOrg.name}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>开始时间（选填）</Label>
              <Input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>结束时间（选填）</Label>
              <Input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={saving}
              onClick={() => void submit("DRAFT")}
            >
              保存草稿
            </Button>
            <Button
              className="flex-1 bg-brand-blue text-white hover:bg-brand-blue/90"
              disabled={saving}
              onClick={() => void submit("ACTIVE")}
            >
              {saving ? "保存中…" : "立即开始"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
