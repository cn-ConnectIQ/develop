"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CheckSquare, Circle, GripVertical, Plus } from "lucide-react";
import { ImeSafeInput } from "@/components/ui/ime-safe-input";
import {
  useInteractionAutoSave,
  patchPoll,
} from "@/hooks/useInteractionAutoSave";

type OptionRow = { id: string; text: string };

type PollOptionsEditorProps = {
  eventId: string;
  pollId: string;
  type: "SINGLE_CHOICE" | "MULTI_CHOICE";
  options: OptionRow[];
  onChange?: (options: OptionRow[]) => void;
};

export function PollOptionsEditor({
  eventId,
  pollId,
  type,
  options: initialOptions,
  onChange,
}: PollOptionsEditorProps) {
  const [options, setOptions] = useState<OptionRow[]>(initialOptions);
  const loadedPollIdRef = useRef<string | null>(null);
  const initialOptionsRef = useRef(initialOptions);
  initialOptionsRef.current = initialOptions;

  useEffect(() => {
    if (loadedPollIdRef.current === pollId) return;
    loadedPollIdRef.current = pollId;
    setOptions(initialOptionsRef.current);
  }, [pollId]);

  const { scheduleSave } = useInteractionAutoSave<
    Array<{ id?: string; text: string }>
  >({
    debounceMs: 800,
    onSave: async (payload) => {
      await patchPoll(eventId, pollId, { options: payload });
    },
  });

  const removeOption = useCallback(
    (optionId: string) => {
      setOptions((prev) => {
        const next = prev.filter((o) => o.id !== optionId);
        onChange?.(next);
        scheduleSave(
          next.map((o) => ({
            id: o.id.startsWith("new-") ? undefined : o.id,
            text: o.text,
          })),
        );
        return next;
      });
    },
    [onChange, scheduleSave],
  );

  const addOption = useCallback(() => {
    setOptions((prev) => {
      const next = [
        ...prev,
        { id: `new-${Date.now()}`, text: `选项 ${prev.length + 1}` },
      ];
      onChange?.(next);
      scheduleSave(
        next.map((o) => ({
          id: o.id.startsWith("new-") ? undefined : o.id,
          text: o.text,
        })),
      );
      return next;
    });
  }, [onChange, scheduleSave]);

  const updateOptionText = useCallback(
    (optionId: string, text: string) => {
      setOptions((prev) => {
        const next = prev.map((o) =>
          o.id === optionId ? { ...o, text } : o,
        );
        onChange?.(next);
        scheduleSave(
          next.map((o) => ({
            id: o.id.startsWith("new-") ? undefined : o.id,
            text: o.text,
          })),
        );
        return next;
      });
    },
    [onChange, scheduleSave],
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOptions((prev) => {
      const oldIndex = prev.findIndex((o) => o.id === active.id);
      const newIndex = prev.findIndex((o) => o.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      onChange?.(next);
      scheduleSave(
        next.map((o) => ({
          id: o.id.startsWith("new-") ? undefined : o.id,
          text: o.text,
        })),
      );
      return next;
    });
  }

  const ChoiceIcon = type === "MULTI_CHOICE" ? CheckSquare : Circle;

  return (
    <div className="mt-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={options.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {options.map((option) => (
              <SortableOptionRow
                key={option.id}
                option={option}
                ChoiceIcon={ChoiceIcon}
                onCommit={(text) => updateOptionText(option.id, text)}
                onRemove={() => removeOption(option.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={addOption}
        className="mt-2 flex cursor-pointer items-center gap-1 text-sm text-brand-blue hover:underline"
      >
        <Plus className="size-3.5" />
        添加选项
      </button>
      <button
        type="button"
        className="ml-4 mt-2 text-sm text-text-muted hover:text-brand-blue"
      >
        添加&quot;其他&quot;选项
      </button>
    </div>
  );
}

function SortableOptionRow({
  option,
  ChoiceIcon,
  onCommit,
  onRemove,
}: {
  option: OptionRow;
  ChoiceIcon: typeof Circle;
  onCommit: (text: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex h-11 items-center gap-2"
    >
      <GripVertical
        className="size-3.5 cursor-grab text-text-muted/30 group-hover:text-text-muted"
        {...attributes}
        {...listeners}
      />
      <ChoiceIcon className="size-3.5 shrink-0 text-text-muted" />
      <ImeSafeInput
        value={option.text}
        debounceMs={800}
        onValueCommit={onCommit}
        placeholder="输入选项"
        className="h-9 flex-1 border-0 bg-transparent text-[15px] shadow-none outline-none placeholder:text-text-muted focus-visible:ring-0"
      />
      <button
        type="button"
        onClick={onRemove}
        className="hidden text-sm text-text-muted hover:text-brand-red group-hover:block"
      >
        ×
      </button>
    </div>
  );
}
