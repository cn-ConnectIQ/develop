"use client";

import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Check, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  buildImportTemplateCsv,
  guessFieldMapping,
  IMPORT_SYSTEM_FIELDS,
  mapRowsWithFields,
  type ImportRow,
  type ImportSystemFieldKey,
} from "@/lib/participants";
import { cn } from "@/lib/utils";

type ImportSheetProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

type ConflictRow = ImportRow & {
  action: "update" | "skip";
  existingName?: string;
};

const STEP_LABELS = ["上传文件", "字段映射", "去重预览", "确认导入"];

export function ImportSheet({
  eventId,
  open,
  onOpenChange,
  onSuccess,
}: ImportSheetProps) {
  const [step, setStep] = useState(1);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<
    ImportSystemFieldKey,
    string | null
  > | null>(null);
  const [mappedRows, setMappedRows] = useState<ImportRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [existingPhones, setExistingPhones] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const reset = useCallback(() => {
    setStep(1);
    setFileHeaders([]);
    setRawRows([]);
    setMapping(null);
    setMappedRows([]);
    setConflicts([]);
    setExistingPhones(new Set());
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    onOpenChange(next);
  }

  function parseFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
        defval: "",
      });
      if (json.length === 0) {
        toast.error("文件为空");
        return;
      }
      const headers = Object.keys(json[0] ?? {});
      setFileHeaders(headers);
      setRawRows(json);
      setMapping(guessFieldMapping(headers));
      setStep(2);
    };
    reader.readAsArrayBuffer(file);
  }

  async function loadExistingPhones() {
    const res = await fetch(
      `/api/events/${eventId}/participants?limit=100`,
    );
    if (!res.ok) return new Set<string>();
    const json = await res.json();
    const phones = (json.data as Array<{ phone: string | null }>)
      .map((p) => p.phone?.trim())
      .filter(Boolean) as string[];
    return new Set(phones);
  }

  async function goToDedupPreview() {
    if (!mapping?.name || !mapping?.phone) {
      toast.error("请映射「姓名」和「手机号」字段");
      return;
    }
    const rows = mapRowsWithFields(rawRows, mapping);
    if (rows.length === 0) {
      toast.error("没有有效数据行");
      return;
    }
    setMappedRows(rows);

    const phones = await loadExistingPhones();
    setExistingPhones(phones);

    const conflictList: ConflictRow[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const phone = row.phone?.trim();
      if (!phone) continue;

      if (seen.has(phone)) {
        conflictList.push({ ...row, action: "skip" });
        continue;
      }
      seen.add(phone);

      if (phones.has(phone)) {
        conflictList.push({ ...row, action: "update", existingName: phone });
      }
    }

    setConflicts(conflictList);
    setStep(3);
  }

  const importStats = useMemo(() => {
    let created = 0;
    let updated = 0;
    let skipped = 0;

    const seen = new Set<string>();
    for (const row of mappedRows) {
      const phone = row.phone?.trim();
      if (!phone) {
        skipped++;
        continue;
      }
      if (seen.has(phone)) {
        skipped++;
        continue;
      }
      seen.add(phone);

      const conflict = conflicts.find((c) => c.phone === phone);
      if (conflict?.action === "skip") {
        skipped++;
      } else if (existingPhones.has(phone)) {
        updated++;
      } else {
        created++;
      }
    }

    return { created, updated, skipped };
  }, [mappedRows, conflicts, existingPhones]);

  async function confirmImport() {
    setSubmitting(true);
    try {
      const rowsToImport = mappedRows.filter((row) => {
        const phone = row.phone?.trim();
        if (!phone) return false;
        const conflict = conflicts.find((c) => c.phone === phone);
        return conflict?.action !== "skip";
      });

      const res = await fetch(`/api/events/${eventId}/participants/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: rowsToImport }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "导入失败");
        return;
      }
      toast.success(
        `导入完成：新增 ${json.data.created}，更新 ${json.data.updated}，跳过 ${json.data.skipped}`,
      );
      handleOpenChange(false);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([buildImportTemplateCsv()], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "参会者导入模板.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-[520px]">
        <SheetHeader>
          <SheetTitle>导入参会者</SheetTitle>
          <div className="mt-2 flex gap-2">
            {STEP_LABELS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 text-center text-[10px]",
                  step === i + 1
                    ? "bg-brand-blue-light font-medium text-brand-blue"
                    : step > i + 1
                      ? "bg-brand-green-light text-brand-green"
                      : "bg-content text-text-muted",
                )}
              >
                {i + 1}. {label}
              </div>
            ))}
          </div>
        </SheetHeader>

        {step === 1 && (
          <div className="mt-6 flex flex-1 flex-col">
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-light px-6 py-14 text-center transition-colors hover:border-brand-blue hover:bg-brand-blue-light/20">
              <Upload className="mb-3 size-8 text-text-tertiary" />
              <span className="text-sm font-medium text-[var(--admin-ink)]">
                点击或拖拽上传文件
              </span>
              <span className="mt-1 text-xs text-text-muted">
                支持 .xlsx / .xls / .csv
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) parseFile(file);
                }}
              />
            </label>
            <button
              type="button"
              className="mt-4 inline-flex items-center gap-1 text-sm text-brand-blue hover:underline"
              onClick={downloadTemplate}
            >
              <Download className="size-4" />
              下载标准模板
            </button>
          </div>
        )}

        {step === 2 && mapping && (
          <div className="mt-6 flex flex-1 flex-col space-y-4">
            <p className="text-sm text-text-muted">
              将文件列映射到系统字段（已自动识别显示 ✓）
            </p>
            <div className="space-y-3 rounded-xl border border-border-light p-4">
              {IMPORT_SYSTEM_FIELDS.map((field) => {
                const autoMatched = guessFieldMapping(fileHeaders)[field.key];
                const isAuto = autoMatched === mapping[field.key] && !!autoMatched;
                return (
                  <div
                    key={field.key}
                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"
                  >
                    <span className="truncate text-sm text-text-muted">
                      {mapping[field.key] ?? "—"}
                    </span>
                    <span className="text-text-tertiary">↔</span>
                    <div className="flex items-center gap-2">
                      <Select
                        value={mapping[field.key] ?? "__none__"}
                        onValueChange={(v) =>
                          setMapping((m) =>
                            m
                              ? {
                                  ...m,
                                  [field.key]: v === "__none__" ? null : v,
                                }
                              : m,
                          )
                        }
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="选择字段" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">不导入</SelectItem>
                          {fileHeaders.map((h) => (
                            <SelectItem key={h} value={h}>
                              {h}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isAuto && (
                        <Check className="size-4 shrink-0 text-brand-green" />
                      )}
                    </div>
                    <Label className="col-span-3 text-xs text-text-muted">
                      系统字段：{field.label}
                      {field.required ? " *" : ""}
                    </Label>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                上一步
              </Button>
              <Button
                className="flex-1 bg-brand-blue text-white hover:bg-brand-blue/90"
                onClick={() => void goToDedupPreview()}
              >
                下一步
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="mt-6 flex flex-1 flex-col space-y-4">
            <p className="text-sm text-text-muted">
              以手机号为主键，共 {conflicts.length} 条冲突/重复记录
            </p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border-light">
              {conflicts.length === 0 ? (
                <p className="p-4 text-sm text-text-muted">无冲突，可直接导入</p>
              ) : (
                conflicts.map((row, i) => (
                  <div
                    key={`${row.phone}-${i}`}
                    className="flex items-center justify-between border-b border-border-light px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-xs text-text-muted">{row.phone}</p>
                    </div>
                    <Select
                      value={row.action}
                      onValueChange={(v) => {
                        if (v !== "update" && v !== "skip") return;
                        setConflicts((prev) =>
                          prev.map((c, idx) =>
                            idx === i ? { ...c, action: v } : c,
                          ),
                        );
                      }}
                    >
                      <SelectTrigger className="h-8 w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="update">更新</SelectItem>
                        <SelectItem value="skip">跳过</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>
                上一步
              </Button>
              <Button
                className="flex-1 bg-brand-blue text-white hover:bg-brand-blue/90"
                onClick={() => setStep(4)}
              >
                下一步
              </Button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="mt-6 flex flex-1 flex-col space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ["新增", importStats.created, "text-brand-green"],
                  ["更新", importStats.updated, "text-brand-blue"],
                  ["跳过", importStats.skipped, "text-text-muted"],
                ] as const
              ).map(([label, count, cls]) => (
                <div
                  key={label}
                  className="rounded-xl border border-border-light bg-content p-4 text-center"
                >
                  <p className={cn("text-2xl font-bold tabular-nums", cls)}>
                    {count}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">{label}</p>
                </div>
              ))}
            </div>
            <p className="text-sm text-text-muted">
              确认后将导入 {importStats.created + importStats.updated} 条记录
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>
                上一步
              </Button>
              <Button
                className="flex-1 bg-brand-blue text-white hover:bg-brand-blue/90"
                disabled={submitting}
                onClick={() => void confirmImport()}
              >
                {submitting ? "导入中..." : "确认导入"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
