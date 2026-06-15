"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Activity, GripVertical, HelpCircle, ImageIcon, Shuffle, UserCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InteractionTitleInput } from "@/components/interactions/InteractionTitleInput";
import {
  useInteractionAutoSave,
  patchLottery,
} from "@/hooks/useInteractionAutoSave";
import type { LotteryPrizeConfig } from "@/lib/interaction/schemas";
import {
  normalizePrizeRanks,
  parsePrizes,
  prizeRankBadgeClass,
  prizeRankLabel,
  type LotteryDetail,
} from "@/lib/lottery-types";
import { cn } from "@/lib/utils";

type DrawMode = "sequential" | "all";

type LotteryEditorProps = {
  lottery: LotteryDetail;
  eventId: string;
  onChange: () => void;
};

type PollOption = { id: string; title: string; type?: string };

async function fetchPolls(
  eventId: string,
  type?: string,
): Promise<PollOption[]> {
  const url = type
    ? `/api/events/${eventId}/polls?type=${type}`
    : `/api/events/${eventId}/polls`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  const data = json.data;
  const polls = Array.isArray(data) ? data : data.polls;
  return polls.map((p: PollOption) => ({ id: p.id, title: p.title, type: p.type }));
}

async function fetchEligibleCount(eventId: string, lotteryId: string) {
  const res = await fetch(
    `/api/events/${eventId}/lotteries/${lotteryId}/eligible-count`,
  );
  if (!res.ok) return null;
  return (await res.json()).data as {
    eligible: number;
    total: number;
    percentage: number;
  };
}

export function LotteryEditor({ lottery, eventId, onChange }: LotteryEditorProps) {
  const [local, setLocal] = useState(lottery);
  const [prizes, setPrizes] = useState<LotteryPrizeConfig[]>(() =>
    parsePrizes(lottery.prizes),
  );
  const [drawMode, setDrawMode] = useState<DrawMode>("sequential");
  const [eligibility, setEligibility] = useState<"all" | "vip" | "speaker">(
    lottery.eligibleRoles.includes("SPEAKER")
      ? "speaker"
      : lottery.eligibleRoles.includes("VIP")
        ? "vip"
        : "all",
  );

  useEffect(() => {
    setLocal(lottery);
    setPrizes(parsePrizes(lottery.prizes));
    setEligibility(
      lottery.eligibleRoles.includes("SPEAKER")
        ? "speaker"
        : lottery.eligibleRoles.includes("VIP")
          ? "vip"
          : "all",
    );
  }, [lottery.id, lottery]);

  const { data: singleChoicePolls = [] } = useQuery({
    queryKey: ["polls", eventId, "SINGLE_CHOICE"],
    queryFn: () => fetchPolls(eventId, "SINGLE_CHOICE"),
  });

  const { data: allPolls = [] } = useQuery({
    queryKey: ["polls", eventId, "all"],
    queryFn: () => fetchPolls(eventId),
  });

  const { data: eligibleData } = useQuery({
    queryKey: ["lottery-eligible", eventId, lottery.id, local.type],
    queryFn: () => fetchEligibleCount(eventId, lottery.id),
    refetchInterval: 30_000,
  });

  const { scheduleSave } = useInteractionAutoSave<Record<string, unknown>>({
    debounceMs: 800,
    onSave: async (payload) => {
      await patchLottery(eventId, lottery.id, payload);
      onChange();
    },
  });

  const persist = useCallback(
    (patch: Record<string, unknown>) => {
      scheduleSave(patch);
    },
    [scheduleSave],
  );

  function updateType(type: LotteryDetail["type"]) {
    const patch: Record<string, unknown> = { type };
    if (type === "CHECKIN_BASED") {
      patch.require_checkin = true;
    }
    if (type === "RANDOM") {
      patch.require_checkin = false;
      patch.require_poll_id = null;
      patch.quiz_poll_id = null;
    }
    setLocal((prev) => ({
      ...prev,
      type,
      requireCheckin: type === "CHECKIN_BASED",
    }));
    persist(patch);
  }

  function updatePrizes(next: LotteryPrizeConfig[]) {
    const normalized = normalizePrizeRanks(next);
    setPrizes(normalized);
    persist({ prizes: normalized });
  }

  function buildEligibleRoles(mode: typeof eligibility) {
    if (mode === "speaker") return ["SPEAKER"];
    if (mode === "vip") return ["VIP"];
    return [];
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = prizes.findIndex((p) => String(p.rank) === active.id);
    const newIndex = prizes.findIndex((p) => String(p.rank) === over.id);
    updatePrizes(arrayMove(prizes, oldIndex, newIndex));
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
      <InteractionTitleInput
        eventId={eventId}
        lotteryId={lottery.id}
        value={local.title}
        placeholder="抽奖标题"
        onSaved={(title) => setLocal((p) => ({ ...p, title }))}
      />

      <div className="mt-4 grid grid-cols-2 gap-3">
        {(
          [
            {
              type: "RANDOM",
              label: "随机抽奖",
              desc: "从所有参与者中随机",
              Icon: Shuffle,
              color: "text-brand-blue",
            },
            {
              type: "QUIZ_BASED",
              label: "答题抽奖",
              desc: "答对才能进入奖池",
              Icon: HelpCircle,
              color: "text-brand-purple",
            },
            {
              type: "CHECKIN_BASED",
              label: "签到抽奖",
              desc: "已签到自动进入奖池",
              Icon: UserCheck,
              color: "text-brand-green",
            },
            {
              type: "ACTIVITY_BASED",
              label: "参与抽奖",
              desc: "参与指定互动才能参与",
              Icon: Activity,
              color: "text-brand-amber",
            },
          ] as const
        ).map(({ type, label, desc, Icon, color }) => {
          const selected = local.type === type;
          return (
            <div key={type}>
              <button
                type="button"
                onClick={() => updateType(type)}
                className={cn(
                  "flex h-[80px] w-full cursor-pointer items-center gap-3 rounded-xl border-2 p-4 text-left transition-colors",
                  selected
                    ? "border-brand-blue bg-brand-blue-light/20"
                    : "border-border-light bg-white hover:border-brand-blue/30",
                )}
              >
                <Icon className={cn("size-5 shrink-0", color)} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-text-muted">{desc}</p>
                </div>
              </button>

              {selected && type === "QUIZ_BASED" && (
                <div className="mt-2 rounded-lg border border-border-light bg-white p-3">
                  <p className="text-xs font-medium">绑定题目</p>
                  <Select
                    value={local.quizPollId ?? ""}
                    onValueChange={(v) => {
                      setLocal((p) => ({ ...p, quizPollId: v }));
                      persist({ quiz_poll_id: v });
                    }}
                  >
                    <SelectTrigger className="mt-2 h-9">
                      <SelectValue placeholder="选择单选投票" />
                    </SelectTrigger>
                    <SelectContent>
                      {singleChoicePolls.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selected && type === "CHECKIN_BASED" && (
                <div className="mt-2 rounded-lg border border-border-light bg-white p-3">
                  <p className="mb-2 text-xs font-medium">参与资格</p>
                  <div className="space-y-2">
                    {(
                      [
                        { key: "all", label: "全部参会者" },
                        { key: "vip", label: "仅 VIP" },
                        { key: "speaker", label: "仅演讲者" },
                      ] as const
                    ).map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="eligibility"
                          checked={eligibility === key}
                          onChange={() => {
                            setEligibility(key);
                            const roles = buildEligibleRoles(key);
                            persist({
                              eligible_roles: roles,
                              require_checkin: true,
                            });
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {selected && type === "ACTIVITY_BASED" && (
                <div className="mt-2 rounded-lg border border-border-light bg-white p-3">
                  <p className="text-xs font-medium">绑定互动</p>
                  <Select
                    value={local.requirePollId ?? ""}
                    onValueChange={(v) => {
                      setLocal((p) => ({ ...p, requirePollId: v }));
                      persist({ require_poll_id: v });
                    }}
                  >
                    <SelectTrigger className="mt-2 h-9">
                      <SelectValue placeholder="选择投票/问卷" />
                    </SelectTrigger>
                    <SelectContent>
                      {allPolls.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="mb-3 mt-6 text-sm font-semibold">奖品设置</p>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={prizes.map((p) => String(p.rank))}
          strategy={verticalListSortingStrategy}
        >
          {prizes.map((prize) => (
            <SortablePrizeRow
              key={prize.rank}
              prize={prize}
              onChange={(next) =>
                updatePrizes(
                  prizes.map((p) => (p.rank === prize.rank ? next : p)),
                )
              }
              onRemove={() =>
                updatePrizes(prizes.filter((p) => p.rank !== prize.rank))
              }
            />
          ))}
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={() =>
          updatePrizes([
            ...prizes,
            {
              rank: prizes.length + 1,
              name: prizeRankLabel(prizes.length + 1),
              prize: "",
              count: 1,
            },
          ])
        }
        className="flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border-light text-sm text-brand-blue hover:border-brand-blue"
      >
        + 添加奖品等级
      </button>

      <fieldset className="mt-4 space-y-2">
        <legend className="text-sm font-medium">抽取方式</legend>
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="radio"
            name="drawMode"
            checked={drawMode === "sequential"}
            onChange={() => setDrawMode("sequential")}
            className="mt-1"
          />
          <div>
            <p className="text-sm">逐级抽取（推荐）</p>
            <p className="ml-0 text-xs text-text-muted">
              先抽三等奖→二等奖→一等奖，制造现场气氛
            </p>
          </div>
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="radio"
            name="drawMode"
            checked={drawMode === "all"}
            onChange={() => setDrawMode("all")}
          />
          <span className="text-sm">一次性全部抽取</span>
        </label>
      </fieldset>

      <div className="mt-3">
        <div className="flex items-center gap-2">
          <Switch
            checked={local.allowReenter}
            onCheckedChange={(checked) => {
              setLocal((p) => ({ ...p, allowReenter: checked }));
              persist({ allow_reenter: checked });
            }}
          />
          <span className="text-sm text-text-muted">允许重复中奖</span>
        </div>
        <p className="mt-1 text-xs text-text-muted">
          关闭时，同一人只能中一个奖项
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-brand-blue/20 bg-brand-blue-light/30 p-4">
        <p className="text-xs text-text-muted">当前符合参与条件的参会者：</p>
        <div className="mt-1 flex items-baseline">
          <span className="text-2xl font-bold text-brand-blue">
            {eligibleData?.eligible ?? "—"}
          </span>
          <span className="ml-1 text-sm text-text-muted">人</span>
        </div>
        {eligibleData && (
          <p className="mt-1 text-xs text-text-muted">
            占总参会者 {eligibleData.total} 人的 {eligibleData.percentage}%
          </p>
        )}
      </div>
    </div>
  );
}

function SortablePrizeRow({
  prize,
  onChange,
  onRemove,
}: {
  prize: LotteryPrizeConfig;
  onChange: (prize: LotteryPrizeConfig) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: String(prize.rank) });
  const fileRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function handleImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      onChange({ ...prize, image_url: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="mb-3 flex items-center gap-3 rounded-xl border border-border-light bg-white p-4"
    >
      <GripVertical
        className="size-3.5 shrink-0 cursor-grab text-text-muted/30 hover:text-text-muted"
        {...attributes}
        {...listeners}
      />
      <span
        className={cn(
          "shrink-0 rounded px-2 py-0.5 text-xs font-bold",
          prizeRankBadgeClass(prize.rank),
        )}
      >
        {prizeRankLabel(prize.rank)}
      </span>
      <Input
        value={prize.prize}
        onChange={(e) => onChange({ ...prize, prize: e.target.value })}
        placeholder="如：iPhone 15 Pro"
        className="h-9 flex-1 border-0 text-sm shadow-none outline-none focus-visible:ring-0"
      />
      <span className="text-xs text-text-muted">×</span>
      <Input
        type="number"
        min={1}
        value={prize.count}
        onChange={(e) =>
          onChange({ ...prize, count: Math.max(1, Number(e.target.value) || 1) })
        }
        className="h-8 w-12 text-center text-sm"
      />
      <span className="text-xs text-text-muted">人</span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImage(file);
        }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="shrink-0 text-text-muted hover:text-brand-blue"
      >
        {prize.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={prize.image_url}
            alt=""
            className="size-5 rounded object-cover"
          />
        ) : (
          <ImageIcon className="size-3.5" />
        )}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="cursor-pointer text-sm text-text-muted hover:text-brand-red"
      >
        ×
      </button>
    </div>
  );
}
