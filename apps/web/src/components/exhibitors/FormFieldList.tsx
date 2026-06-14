"use client";

import { useEffect, useState } from "react";
import { ChevronDown, GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  FORM_FIELD_TYPE_OPTIONS,
  MARKETUP_FIELD_OPTIONS,
  TYPE_BADGE_CLASS,
  TYPE_BADGE_LABEL,
} from "@/lib/form-config";
import type { FormFieldType, LeadFormField } from "@/types/booth";
import { cn } from "@/lib/utils";

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

        <span
          className={cn(
            "shrink-0 rounded px-2 py-0.5 text-[10px] font-medium",
            TYPE_BADGE_CLASS[field.type],
          )}
        >
          {TYPE_BADGE_LABEL[field.type]}
        </span>

        {field.marketupField && (
          <span className="hidden shrink-0 text-[10px] text-brand-purple xl:inline">
            → MarketUP: {field.marketupField}
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
              确定删除「{field.label}」吗？此操作不可撤销。
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

  useEffect(() => {
    if (field) setDraft(field);
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
            <Label className="text-xs">字段名称</Label>
            <Input
              className="mt-1"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">字段类型</Label>
            <Select
              value={draft.type}
              onValueChange={(v) =>
                setDraft({
                  ...draft,
                  type: v as FormFieldType,
                  options:
                    v === "select" || v === "multiselect"
                      ? draft.options ?? ["选项1"]
                      : undefined,
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORM_FIELD_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.type} value={opt.type}>
                    {opt.label}
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
                value={(draft.options ?? []).join("\n")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    options: e.target.value
                      .split("\n")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
              />
            </div>
          )}
          <div>
            <Label className="text-xs">MarketUP 映射字段</Label>
            <Select
              value={draft.marketupField ?? ""}
              onValueChange={(v) =>
                setDraft({ ...draft, marketupField: v || undefined })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="选择映射字段" />
              </SelectTrigger>
              <SelectContent>
                {MARKETUP_FIELD_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
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
              onSave(draft);
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

type FormFieldListProps = {
  fields: LeadFormField[];
  onChange: (fields: LeadFormField[]) => void;
};

export function FormFieldList({ fields, onChange }: FormFieldListProps) {
  const [addOpen, setAddOpen] = useState(false);
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

  function addField(type: FormFieldType) {
    const field: LeadFormField = {
      id: `field_${Date.now()}`,
      label: "新字段",
      type,
      required: false,
      sortOrder: fields.length,
      options:
        type === "select" || type === "multiselect" ? ["选项1", "选项2"] : undefined,
    };
    onChange([...fields, field]);
    setAddOpen(false);
    setEditField(field);
  }

  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <h3 className="mb-4 font-semibold">自定义采集字段</h3>

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

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-light py-3 text-sm text-text-muted transition-colors hover:border-brand-blue/50 hover:bg-brand-blue-light/20 hover:text-brand-blue">
          <Plus className="size-4" />
          添加字段
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          <div className="grid gap-1">
            {FORM_FIELD_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => addField(opt.type)}
                className="rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100"
              >
                {opt.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

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
