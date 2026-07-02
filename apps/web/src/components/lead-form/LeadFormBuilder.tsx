"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  Building2,
  GripVertical,
  Mail,
  MessageSquare,
  Pencil,
  Phone,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  createFieldFromPreset,
  LEAD_FORM_FIELD_PRESETS,
  type LeadFormFieldPreset,
} from "@/lib/lead-form/templates";
import type { LeadFormField, LeadFormFieldType } from "@/lib/lead-form/types";
import { cn } from "@/lib/utils";
import { LeadFormPreview } from "./LeadFormPreview";

const PRESET_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  name: User,
  phone: Phone,
  email: Mail,
  company: Building2,
  title: User,
  need: MessageSquare,
  intent: MessageSquare,
  custom: Plus,
};

const TYPE_LABELS: Record<LeadFormFieldType, string> = {
  text: "文本",
  phone: "手机",
  email: "邮件",
  select: "单选",
  multiselect: "多选",
  textarea: "多行",
};

function SortableFieldRow({
  field,
  onChange,
  onDelete,
  onEdit,
}: {
  field: LeadFormField;
  onChange: (field: LeadFormField) => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const [editingLabel, setEditingLabel] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  return (
    <>
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={cn(
          "flex items-center gap-3 rounded-lg border border-border-light bg-white px-3 py-2.5",
          isDragging && "shadow-md",
        )}
      >
        <button
          type="button"
          className="cursor-grab opacity-30 transition-opacity hover:opacity-100"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4 text-text-muted" />
        </button>

        {editingLabel ? (
          <Input
            autoFocus
            value={field.label}
            onChange={(e) => onChange({ ...field, label: e.target.value })}
            onBlur={() => setEditingLabel(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingLabel(false)}
            className="h-8 flex-1 text-sm"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditingLabel(true)}
            className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:text-brand-blue"
          >
            {field.label}
          </button>
        )}

        <span className="shrink-0 rounded bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-text-muted">
          {TYPE_LABELS[field.type]}
        </span>

        {field.prefill_from && (
          <span className="hidden shrink-0 text-[10px] text-brand-purple xl:inline">
            自动带入
          </span>
        )}

        <Switch
          checked={field.required}
          onCheckedChange={(v) => onChange({ ...field, required: v })}
          aria-label="必填"
        />

        <button
          type="button"
          onClick={onEdit}
          className="text-text-tertiary hover:text-brand-blue"
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="text-text-tertiary hover:text-brand-red"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除字段</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{field.label}」吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-brand-red hover:bg-brand-red/90"
              onClick={onDelete}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function parseOptionsText(text: string): string[] {
  return text
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function FieldEditSheet({
  field,
  open,
  onOpenChange,
  onSave,
}: {
  field: LeadFormField | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (field: LeadFormField) => void;
}) {
  const [draft, setDraft] = useState<LeadFormField | null>(field);
  const [optionsText, setOptionsText] = useState("");

  useEffect(() => {
    if (field) {
      setDraft(field);
      setOptionsText((field.options ?? []).join("\n"));
    }
  }, [field]);

  if (!draft) return null;

  const hasOptions =
    draft.type === "select" || draft.type === "multiselect";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[480px] sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>编辑字段</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div>
            <Label className="text-xs">展示名称</Label>
            <Input
              className="mt-1"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">占位提示</Label>
            <Input
              className="mt-1"
              value={draft.placeholder ?? ""}
              onChange={(e) =>
                setDraft({ ...draft, placeholder: e.target.value || undefined })
              }
            />
          </div>
          <div>
            <Label className="text-xs">字段类型</Label>
            <Select
              value={draft.type}
              onValueChange={(v) => {
                const nextType = v as LeadFormFieldType;
                const nextOptions =
                  nextType === "select" || nextType === "multiselect"
                    ? (draft.options ?? ["选项1"])
                    : undefined;
                setDraft({
                  ...draft,
                  type: nextType,
                  options: nextOptions,
                });
                if (nextType === "select" || nextType === "multiselect") {
                  setOptionsText((nextOptions ?? []).join("\n"));
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(TYPE_LABELS) as LeadFormFieldType[]).map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {hasOptions && (
            <div>
              <Label className="text-xs">选项（每行一个）</Label>
              <Textarea
                className="mt-1 min-h-24"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </div>
          )}
          <div>
            <Label className="text-xs">自动带入</Label>
            <Select
              value={draft.prefill_from ?? "none"}
              onValueChange={(v) =>
                setDraft({
                  ...draft,
                  prefill_from:
                    v === "none"
                      ? undefined
                      : (v as LeadFormField["prefill_from"]),
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="不自动带入" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">不自动带入</SelectItem>
                <SelectItem value="user.name">用户姓名</SelectItem>
                <SelectItem value="user.phone">用户手机</SelectItem>
                <SelectItem value="user.company">用户公司</SelectItem>
                <SelectItem value="user.title">用户职位</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs">必填</Label>
            <Switch
              checked={draft.required}
              onCheckedChange={(v) => setDraft({ ...draft, required: v })}
            />
          </div>
          <Button
            className="w-full bg-brand-blue hover:bg-brand-blue/90"
            onClick={() => {
              onSave({
                ...draft,
                options: hasOptions ? parseOptionsText(optionsText) : undefined,
              });
              onOpenChange(false);
            }}
          >
            确认
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export type LeadFormBuilderProps = {
  fields: LeadFormField[];
  onChange: (fields: LeadFormField[]) => void;
  previewTitle?: string;
};

export function LeadFormBuilder({
  fields,
  onChange,
  previewTitle,
}: LeadFormBuilderProps) {
  const [editField, setEditField] = useState<LeadFormField | null>(null);
  const sensors = useSensors(useSensor(PointerSensor));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    const next = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
      ...f,
      sortOrder: i,
    }));
    onChange(next);
  }

  function addPreset(preset: LeadFormFieldPreset) {
    const field = createFieldFromPreset(preset, fields.length);
    onChange([...fields, field]);
    if (preset.key === "custom" || preset.key === "intent") {
      setEditField(field);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr_400px]">
      <div className="rounded-xl border border-border-light bg-white p-4">
        <h3 className="mb-3 text-sm font-semibold">添加字段</h3>
        <div className="grid gap-2">
          {LEAD_FORM_FIELD_PRESETS.map((preset) => {
            const Icon = PRESET_ICONS[preset.key] ?? Plus;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => addPreset(preset)}
                className="flex items-start gap-3 rounded-lg border border-border-light p-3 text-left transition-colors hover:border-brand-blue/40 hover:bg-brand-blue-light/20"
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-brand-blue" />
                <div>
                  <p className="text-sm font-medium">{preset.label}</p>
                  <p className="text-xs text-text-muted">{preset.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-border-light bg-white p-4">
        <h3 className="mb-4 font-semibold">表单字段</h3>

        {fields.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border-light py-12 text-center text-sm text-text-muted">
            从左侧选择字段类型开始配置
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {fields.map((field) => (
                  <SortableFieldRow
                    key={field.id}
                    field={field}
                    onChange={(updated) =>
                      onChange(fields.map((f) => (f.id === updated.id ? updated : f)))
                    }
                    onDelete={() => onChange(fields.filter((f) => f.id !== field.id))}
                    onEdit={() => setEditField(field)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <LeadFormPreview fields={fields} title={previewTitle} />

      <FieldEditSheet
        field={editField}
        open={Boolean(editField)}
        onOpenChange={(open) => !open && setEditField(null)}
        onSave={(updated) =>
          onChange(fields.map((f) => (f.id === updated.id ? updated : f)))
        }
      />
    </div>
  );
}
