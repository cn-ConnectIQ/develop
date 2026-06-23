"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag } from "lucide-react";
import { toast } from "sonner";
import type { ColumnDef } from "@/components/ui/data-table";
import { AdminContent } from "@/components/admin/admin-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
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
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type IntentTagRow = {
  id: string;
  label: string;
  slug: string;
  category: string | null;
  color: string | null;
  sortOrder: number;
};

const CATEGORIES = [
  { value: "TRADING", label: "采购/交易" },
  { value: "INVESTING", label: "投资" },
  { value: "PARTNERING", label: "合作" },
  { value: "RECRUITING", label: "招聘" },
  { value: "NETWORKING", label: "社交" },
];

async function fetchTags() {
  const res = await fetch("/api/platform/intent-tags");
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data.tags as IntentTagRow[];
}

export function PlatformIntentTagsClient() {
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTag, setEditTag] = useState<IntentTagRow | null>(null);
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("");
  const [color, setColor] = useState("#185FA5");

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ["platform-intent-tags"],
    queryFn: fetchTags,
  });

  const columns = useMemo<ColumnDef<IntentTagRow>[]>(
    () => [
      { accessorKey: "label", header: "标签名" },
      { accessorKey: "slug", header: "Slug" },
      {
        accessorKey: "category",
        header: "分类",
        cell: ({ row }) =>
          CATEGORIES.find((c) => c.value === row.original.category)?.label ??
          "—",
      },
      {
        accessorKey: "color",
        header: "颜色",
        cell: ({ row }) =>
          row.original.color ? (
            <span
              className="inline-block size-4 rounded"
              style={{ backgroundColor: row.original.color }}
            />
          ) : (
            "—"
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditTag(row.original);
                setLabel(row.original.label);
                setCategory(row.original.category ?? "");
                setColor(row.original.color ?? "#185FA5");
                setSheetOpen(true);
              }}
            >
              编辑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-brand-red"
              onClick={async () => {
                const res = await fetch(
                  `/api/platform/intent-tags/${row.original.id}`,
                  { method: "DELETE" },
                );
                if (!res.ok) {
                  toast.error("删除失败");
                  return;
                }
                toast.success("已删除");
                void queryClient.invalidateQueries({
                  queryKey: ["platform-intent-tags"],
                });
              }}
            >
              删除
            </Button>
          </div>
        ),
      },
    ],
    [queryClient],
  );

  async function handleSave() {
    if (!label.trim()) {
      toast.error("请填写标签名");
      return;
    }
    const payload = {
      label: label.trim(),
      category: category || undefined,
      color,
    };
    const res = await fetch(
      editTag
        ? `/api/platform/intent-tags/${editTag.id}`
        : "/api/platform/intent-tags",
      {
        method: editTag ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      toast.error("保存失败");
      return;
    }
    toast.success(editTag ? "已更新" : "已创建");
    setSheetOpen(false);
    setEditTag(null);
    setLabel("");
    void queryClient.invalidateQueries({ queryKey: ["platform-intent-tags"] });
  }

  return (
    <AdminContent>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tag className="size-5 text-brand-purple" />
          <p className="text-sm text-text-muted">
            平台级模板，活动创建时可一键复制到展会
          </p>
          <Badge>{tags.length} 个</Badge>
        </div>
        <Button
          className="bg-brand-blue text-white"
          onClick={() => {
            setEditTag(null);
            setLabel("");
            setCategory("");
            setSheetOpen(true);
          }}
        >
          <Plus className="mr-1 size-4" />
          新建模板
        </Button>
      </div>
      <DataTable columns={columns} data={tags} isLoading={isLoading} />

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{editTag ? "编辑标签" : "新建标签模板"}</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4 px-1">
            <div>
              <Label>标签名</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div>
              <Label>分类</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="选择分类" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>颜色</Label>
              <Input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={() => void handleSave()}>保存</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AdminContent>
  );
}
