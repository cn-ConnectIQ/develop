"use client";

import { Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CUSTOM_STAMP_POINT_TYPES,
  STAMP_EMOJI_OPTIONS,
  STAMP_POINT_TYPE_LABELS,
  buildDefaultBoothStamp,
  buildDefaultCustomStamp,
  isBoothStampPoint,
  stampPointClientKey,
  type StampPointConfig,
  type StampPointType,
} from "@/lib/stamp/stamp-rally-config";
import { cn } from "@/lib/utils";

export type BoothOption = {
  id: string;
  code: string;
  name: string;
  companyOrg: { id: string; name: string };
};

type StampPointTableProps = {
  booths: BoothOption[];
  stamps: StampPointConfig[];
  onChange: (stamps: StampPointConfig[]) => void;
  disabled?: boolean;
};

function IconPicker({
  value,
  disabled,
  onChange,
  onUpload,
}: {
  value?: string | null;
  disabled?: boolean;
  onChange: (icon: string) => void;
  onUpload: (file: File) => void;
}) {
  const isEmoji =
    value && !value.startsWith("http") && !value.startsWith("/");

  return (
    <div className="flex flex-wrap items-center gap-1">
      {STAMP_EMOJI_OPTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          disabled={disabled}
          className={cn(
            "flex size-7 items-center justify-center rounded-md text-base transition-colors",
            value === emoji
              ? "bg-brand-blue-light ring-1 ring-brand-blue"
              : "hover:bg-gray-100",
          )}
          onClick={() => onChange(emoji)}
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
            if (file) onUpload(file);
          }}
        />
        <span className="inline-flex size-7 items-center justify-center rounded-md border border-border-light text-text-muted hover:bg-gray-50">
          <Upload className="size-3.5" />
        </span>
      </label>
      {value && !isEmoji && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="size-7 rounded-md object-cover" />
      )}
    </div>
  );
}

export function StampPointTable({
  booths,
  stamps,
  onChange,
  disabled,
}: StampPointTableProps) {
  const selectedBoothIds = new Set(
    stamps
      .filter((s) => isBoothStampPoint(s) && s.booth_id)
      .map((s) => s.booth_id!),
  );
  const availableBooths = booths.filter((b) => !selectedBoothIds.has(b.id));
  const hasBooths = booths.length > 0;

  function addBooth(boothId: string) {
    const booth = booths.find((b) => b.id === boothId);
    if (!booth) return;
    onChange([
      ...stamps,
      buildDefaultBoothStamp(booth.id, booth.code, booth.companyOrg.name),
    ]);
  }

  function addCustomPoint(
    pointType: Exclude<StampPointType, "BOOTH"> = "CUSTOM",
  ) {
    onChange([...stamps, buildDefaultCustomStamp(pointType)]);
  }

  function updateStamp(index: number, patch: Partial<StampPointConfig>) {
    onChange(
      stamps.map((s, i) => {
        if (i !== index) return s;
        const next = { ...s, ...patch };
        if (patch.custom_name !== undefined || patch.name !== undefined) {
          if (!isBoothStampPoint(next)) {
            next.name = next.custom_name?.trim() || next.name;
          }
        }
        if (patch.point_type && patch.point_type !== "BOOTH") {
          next.booth_id = null;
        }
        if (patch.point_type === "BOOTH" && !next.booth_id) {
          next.custom_name = null;
          next.location = null;
        }
        return next;
      }),
    );
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {hasBooths && (
          <Select
            disabled={disabled || availableBooths.length === 0}
            onValueChange={(id) => {
              if (id) addBooth(id);
            }}
            value=""
          >
            <SelectTrigger className="h-9 w-[200px] text-sm">
              <SelectValue placeholder="从展位选择" />
            </SelectTrigger>
            <SelectContent>
              {availableBooths.map((booth) => (
                <SelectItem key={booth.id} value={booth.id}>
                  {booth.code} · {booth.companyOrg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          disabled={disabled}
          onValueChange={(value) => {
            if (value) {
              addCustomPoint(value as Exclude<StampPointType, "BOOTH">);
            }
          }}
          value=""
        >
          <SelectTrigger className="h-9 w-[200px] text-sm">
            <SelectValue placeholder="添加自定义打卡点" />
          </SelectTrigger>
          <SelectContent>
            {CUSTOM_STAMP_POINT_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {STAMP_POINT_TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!hasBooths && (
        <p className="text-xs text-text-muted">
          本活动暂无展位，可直接添加自定义打卡点（赞助商区、分会场、合影台等）。
        </p>
      )}

      {stamps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-light py-10 text-center text-sm text-text-muted">
          从展位选择或添加自定义打卡点，两种方式可混用
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-light">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-content text-left text-text-muted">
              <tr className="border-b border-border-light">
                <th className="p-2.5">类型</th>
                <th className="p-2.5">名称 / 展位</th>
                <th className="p-2.5">位置</th>
                <th className="p-2.5">章图案</th>
                <th className="p-2.5">权重</th>
                <th className="p-2.5">必须集</th>
                <th className="w-10 p-2.5" />
              </tr>
            </thead>
            <tbody>
              {stamps.map((stamp, index) => {
                const booth =
                  isBoothStampPoint(stamp) && stamp.booth_id
                    ? booths.find((b) => b.id === stamp.booth_id)
                    : null;
                const isBooth = isBoothStampPoint(stamp);

                return (
                  <tr
                    key={stampPointClientKey(stamp)}
                    className="border-b border-border-light last:border-0"
                  >
                    <td className="p-2.5 align-top">
                      {isBooth ? (
                        <span className="inline-flex rounded-md bg-brand-blue-light px-2 py-0.5 text-xs text-brand-blue">
                          展位
                        </span>
                      ) : (
                        <Select
                          disabled={disabled}
                          value={stamp.point_type}
                          onValueChange={(v) =>
                            updateStamp(index, {
                              point_type: v as StampPointType,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 w-[120px] text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CUSTOM_STAMP_POINT_TYPES.map((type) => (
                              <SelectItem key={type} value={type}>
                                {STAMP_POINT_TYPE_LABELS[type]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="p-2.5 align-top">
                      {isBooth ? (
                        <div>
                          <p className="font-medium">{booth?.code ?? "—"}</p>
                          <p className="text-xs text-text-muted">
                            {booth?.companyOrg.name ?? "—"}
                          </p>
                          <Input
                            disabled={disabled}
                            value={stamp.name}
                            onChange={(e) =>
                              updateStamp(index, { name: e.target.value })
                            }
                            className="mt-1 h-8"
                            placeholder="章显示名称"
                          />
                        </div>
                      ) : (
                        <Input
                          disabled={disabled}
                          value={stamp.custom_name ?? stamp.name}
                          onChange={(e) =>
                            updateStamp(index, {
                              custom_name: e.target.value,
                              name: e.target.value,
                            })
                          }
                          className="h-8"
                          placeholder="如「主舞台签到」「VIP 休息区打卡」"
                        />
                      )}
                    </td>
                    <td className="p-2.5 align-top">
                      {isBooth ? (
                        <span className="text-xs text-text-muted">—</span>
                      ) : (
                        <Input
                          disabled={disabled}
                          value={stamp.location ?? ""}
                          onChange={(e) =>
                            updateStamp(index, { location: e.target.value })
                          }
                          className="h-8"
                          placeholder="A 厅东侧入口"
                        />
                      )}
                    </td>
                    <td className="p-2.5 align-top">
                      <IconPicker
                        value={stamp.icon}
                        disabled={disabled}
                        onChange={(icon) => updateStamp(index, { icon })}
                        onUpload={(file) => void uploadIcon(index, file)}
                      />
                    </td>
                    <td className="p-2.5 align-top">
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
                    <td className="p-2.5 align-top">
                      <Checkbox
                        disabled={disabled}
                        checked={stamp.required}
                        onCheckedChange={(checked) =>
                          updateStamp(index, { required: checked === true })
                        }
                      />
                    </td>
                    <td className="p-2.5 align-top">
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

      {hasBooths && availableBooths.length > 0 && stamps.length > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => addBooth(availableBooths[0]!.id)}
        >
          <Plus className="mr-1 size-4" />
          快速添加展位 {availableBooths[0]!.code}
        </Button>
      )}
    </div>
  );
}

/** @deprecated 使用 StampPointTable */
export { StampPointTable as BoothStampTable };
