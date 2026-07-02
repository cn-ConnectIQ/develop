"use client";

import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  STAMP_EMOJI_OPTIONS,
  buildDefaultBoothStamp,
  type BoothStampConfig,
} from "@/lib/stamp/stamp-rally-config";
import { cn } from "@/lib/utils";

export type BoothOption = {
  id: string;
  code: string;
  name: string;
  companyOrg: { id: string; name: string };
};

type BoothStampTableProps = {
  booths: BoothOption[];
  stamps: BoothStampConfig[];
  onChange: (stamps: BoothStampConfig[]) => void;
  disabled?: boolean;
};

export function BoothStampTable({
  booths,
  stamps,
  onChange,
  disabled,
}: BoothStampTableProps) {
  const selectedIds = new Set(stamps.map((s) => s.booth_id));
  const available = booths.filter((b) => !selectedIds.has(b.id));

  function addBooth(boothId: string) {
    const booth = booths.find((b) => b.id === boothId);
    if (!booth) return;
    onChange([
      ...stamps,
      buildDefaultBoothStamp(booth.id, booth.code, booth.companyOrg.name),
    ]);
  }

  function updateStamp(index: number, patch: Partial<BoothStampConfig>) {
    onChange(stamps.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function removeStamp(index: number) {
    onChange(stamps.filter((_, i) => i !== index));
  }

  async function uploadIcon(index: number, file: File) {
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "上传失败");
      const url = json.data?.url ?? json.url;
      updateStamp(index, { icon: url });
      toast.success("章图案上传成功");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>展位章设置</Label>
        {available.length > 0 && (
          <Select
            disabled={disabled}
            onValueChange={(id) => {
              if (id) addBooth(id);
            }}
            value=""
          >
            <SelectTrigger className="h-8 w-[180px] text-sm">
              <SelectValue placeholder="添加展位" />
            </SelectTrigger>
            <SelectContent>
              {available.map((booth) => (
                <SelectItem key={booth.id} value={booth.id}>
                  {booth.code} · {booth.companyOrg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {stamps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-light py-10 text-center text-sm text-text-muted">
          从上方下拉菜单选择参与展位
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-light">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-content text-left text-text-muted">
              <tr className="border-b border-border-light">
                <th className="p-2.5">展位</th>
                <th className="p-2.5">章名称</th>
                <th className="p-2.5">章图案</th>
                <th className="p-2.5">权重</th>
                <th className="p-2.5">必须集</th>
                <th className="w-10 p-2.5" />
              </tr>
            </thead>
            <tbody>
              {stamps.map((stamp, index) => {
                const booth = booths.find((b) => b.id === stamp.booth_id);
                const isEmoji =
                  stamp.icon &&
                  !stamp.icon.startsWith("http") &&
                  !stamp.icon.startsWith("/");

                return (
                  <tr
                    key={stamp.booth_id}
                    className="border-b border-border-light last:border-0"
                  >
                    <td className="p-2.5">
                      <p className="font-medium">{booth?.code ?? "—"}</p>
                      <p className="text-xs text-text-muted">
                        {booth?.companyOrg.name ?? "—"}
                      </p>
                    </td>
                    <td className="p-2.5">
                      <Input
                        disabled={disabled}
                        value={stamp.name}
                        onChange={(e) =>
                          updateStamp(index, { name: e.target.value })
                        }
                        className="h-8"
                      />
                    </td>
                    <td className="p-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {STAMP_EMOJI_OPTIONS.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            disabled={disabled}
                            className={cn(
                              "flex size-7 items-center justify-center rounded-md text-base transition-colors",
                              stamp.icon === emoji
                                ? "bg-brand-blue-light ring-1 ring-brand-blue"
                                : "hover:bg-gray-100",
                            )}
                            onClick={() => updateStamp(index, { icon: emoji })}
                          >
                            {emoji}
                          </button>
                        ))}
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            disabled={disabled}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void uploadIcon(index, file);
                            }}
                          />
                          <span className="inline-flex size-7 items-center justify-center rounded-md border border-border-light text-text-muted hover:bg-gray-50">
                            <Upload className="size-3.5" />
                          </span>
                        </label>
                        {stamp.icon && !isEmoji && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={stamp.icon}
                            alt=""
                            className="size-7 rounded-md object-cover"
                          />
                        )}
                      </div>
                    </td>
                    <td className="p-2.5">
                      <Select
                        disabled={disabled}
                        value={String(stamp.weight)}
                        onValueChange={(v) =>
                          updateStamp(index, { weight: Number(v) })
                        }
                      >
                        <SelectTrigger className="h-8 w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">×1</SelectItem>
                          <SelectItem value="2">×2</SelectItem>
                          <SelectItem value="3">×3</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-2.5">
                      <Checkbox
                        disabled={disabled}
                        checked={stamp.required}
                        onCheckedChange={(checked) =>
                          updateStamp(index, { required: checked === true })
                        }
                      />
                    </td>
                    <td className="p-2.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-text-muted hover:text-red-600"
                        disabled={disabled}
                        onClick={() => removeStamp(index)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {available.length > 0 && stamps.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => addBooth(available[0]!.id)}
        >
          <Plus className="mr-1 size-4" />
          快速添加 {available[0]!.code}
        </Button>
      )}
    </div>
  );
}
