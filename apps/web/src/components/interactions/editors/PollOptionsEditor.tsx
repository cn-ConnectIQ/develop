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
import { Input } from "@/components/ui/input";
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

  const persist = useCallback(
    (next: OptionRow[]) => {
      setOptions(next);
      onChange?.(next);
      scheduleSave(
        next.map((o) => ({
          id: o.id.startsWith("new-") ? undefined : o.id,
          text: o.text,
        })),
      );
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
    const oldIndex = options.findIndex((o) => o.id === active.id);
    const newIndex = options.findIndex((o) => o.id === over.id);
    persist(arrayMove(options, oldIndex, newIndex));
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
                onChange={(text) =>
                  persist(
                    options.map((o) =>
                      o.id === option.id ? { ...o, text } : o,
                    ),
                  )
                }
                onRemove={() =>
                  persist(options.filter((o) => o.id !== option.id))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() =>
          persist([
            ...options,
            { id: `new-${Date.now()}`, text: `选项 ${options.length + 1}` },
          ])
        }
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
  onChange,
  onRemove,
}: {
  option: OptionRow;
  ChoiceIcon: typeof Circle;
  onChange: (text: string) => void;
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
      <Input
        value={option.text}
        onChange={(e) => onChange(e.target.value)}
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
