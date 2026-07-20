"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AnnouncementWorkspace } from "@/components/interactions/AnnouncementWorkspace";
import { QnaManager } from "@/components/interactions/QnaManager";
import { InteractionTitleInput } from "@/components/interactions/InteractionTitleInput";
import { InteractionSettings } from "@/components/interactions/InteractionSettings";
import { InteractionEditLayout } from "@/components/interactions/InteractionEditLayout";
import { MobilePreview } from "@/components/interactions/MobilePreview";
import {
  PollCreatorTypeTabs,
  pollTypeToTab,
  tabToPollType,
  type PollCreatorTab,
} from "@/components/interactions/PollCreatorTypeTabs";
import { PollResultVisualPicker } from "@/components/interactions/PollResultVisualPicker";
import {
  CreationSection,
} from "@/components/admin/content-creation-layout";
import { RealtimeConsole } from "@/components/interactions/RealtimeConsole";
import { PollOptionsEditor } from "@/components/interactions/editors/PollOptionsEditor";
import { WordCloudEditor } from "@/components/interactions/editors/WordCloudEditor";
import { RatingPollEditor } from "@/components/interactions/editors/RatingPollEditor";
import {
  isPollLive,
  isPollPaused,
  normalizePollOptionsForType,
  type InteractionItem,
  type InteractionPollItem,
} from "@/lib/interaction-manager";
import type { SessionOption } from "@/lib/interactions";
import { patchPoll } from "@/hooks/useInteractionAutoSave";
import {
  DEFAULT_DISPLAY_CONFIG,
  type PollResultVisual,
} from "@/lib/bigscreen-display";
import { withPublicPath } from "@/lib/public-path";

type InteractionWorkspaceProps = {
  eventId: string;
  selection: InteractionItem | null;
  sessions: SessionOption[];
  onRefresh: () => void;
  onDelete: (item: InteractionItem) => void;
  onActivate: (item: InteractionItem) => void;
  onPause: (item: InteractionItem) => void;
  onStop: (item: InteractionItem) => void;
};

export function InteractionWorkspace({
  eventId,
  selection,
  sessions,
  onRefresh,
  onDelete,
  onActivate,
  onPause,
  onStop,
}: InteractionWorkspaceProps) {
  if (!selection) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <BarChart2 className="size-12 text-text-tertiary/40" />
        <p className="mt-3 text-sm text-text-muted">选择左侧的互动进行编辑</p>
        <p className="mt-1 text-xs text-text-tertiary">
          或点击「+ 创建互动」开始
        </p>
      </div>
    );
  }

  if (selection.kind === "announcement") {
    return (
      <AnnouncementWorkspace
        eventId={eventId}
        item={selection}
        onRefresh={onRefresh}
        onDelete={onDelete}
      />
    );
  }

  if (selection.kind === "lottery") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-text-muted">
          抽奖请在「现场抽奖」菜单中管理
        </p>
      </div>
    );
  }

  if (
    selection.kind === "poll" &&
    selection.type === "QNA" &&
    selection.status !== "DRAFT"
  ) {
    return (
      <QnaManager
        pollId={selection.id}
        eventId={eventId}
        pollStatus={selection.status}
        onStatusChange={onRefresh}
      />
    );
  }

  // 仅 LIVE 进实时控制台；PAUSED 进入可编辑工作区
  if (selection.kind === "poll" && isPollLive(selection.status)) {
    return (
      <RealtimeConsole
        eventId={eventId}
        poll={selection}
        onPause={() => onPause(selection)}
        onStop={() => onStop(selection)}
        onExtend={async () => {
          await patchPoll(eventId, selection.id, { extendMinutes: 2 });
          onRefresh();
          toast.success("已延长 2 分钟");
        }}
      />
    );
  }

  if (selection.kind !== "poll") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center">
        <BarChart2 className="size-12 text-text-tertiary/40" />
        <p className="mt-3 text-sm text-text-muted">选择左侧的互动进行编辑</p>
      </div>
    );
  }

  return (
    <PollEditWorkspace
      eventId={eventId}
      poll={selection}
      sessions={sessions}
      onRefresh={onRefresh}
      onActivate={() => onActivate(selection)}
      onStop={
        isPollPaused(selection.status) ? () => onStop(selection) : undefined
      }
    />
  );
}

function PollEditWorkspace({
  eventId,
  poll,
  sessions,
  onRefresh,
  onActivate,
  onStop,
}: {
  eventId: string;
  poll: InteractionPollItem;
  sessions: SessionOption[];
  onRefresh: () => void;
  onActivate: () => void;
  onStop?: () => void;
}) {
  const paused = isPollPaused(poll.status);
  const [localPoll, setLocalPoll] = useState(poll);
  const [activeTab, setActiveTab] = useState<PollCreatorTab>(() =>
    pollTypeToTab(poll.type),
  );
  const [multiChoice, setMultiChoice] = useState(poll.type === "MULTI_CHOICE");
  const [resultVisual, setResultVisual] = useState<PollResultVisual>(
    DEFAULT_DISPLAY_CONFIG.resultVisual ?? "race_bar",
  );
  const [savingDraft, setSavingDraft] = useState(false);
  const [typeChanging, setTypeChanging] = useState(false);

  useEffect(() => {
    setLocalPoll(poll);
    setActiveTab(pollTypeToTab(poll.type));
    setMultiChoice(poll.type === "MULTI_CHOICE");
  }, [poll.id, poll.type, poll.title, poll.options, poll.status]);

  useEffect(() => {
    void fetch(withPublicPath(`/api/events/${eventId}/polls/${poll.id}/display`))
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const visual = json?.data?.resultVisual as PollResultVisual | undefined;
        if (visual) setResultVisual(visual);
      })
      .catch(() => undefined);
  }, [eventId, poll.id]);

  async function persistResultVisual(visual: PollResultVisual) {
    setResultVisual(visual);
    await fetch(
      withPublicPath(`/api/events/${eventId}/polls/${poll.id}/display`),
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultVisual: visual }),
      },
    );
  }

  async function handleTabChange(tab: PollCreatorTab) {
    if (tab === activeTab) return;
    const nextType = tabToPollType(tab, multiChoice);
    if (nextType === localPoll.type) {
      setActiveTab(tab);
      return;
    }
    setTypeChanging(true);
    try {
      const nextOptions = normalizePollOptionsForType(
        nextType,
        localPoll.options,
      );
      await patchPoll(eventId, poll.id, {
        type: nextType,
        status: "DRAFT",
        options: nextOptions,
      });
      setActiveTab(tab);
      setLocalPoll((p) => ({
        ...p,
        type: nextType,
        options: nextOptions.map((o, i) => ({
          id: o.id ?? `opt-${i}`,
          text: o.text,
        })),
      }));
      onRefresh();
      toast.success("已切换问题类型");
    } catch {
      toast.error("切换类型失败");
    } finally {
      setTypeChanging(false);
    }
  }

  async function toggleMultiChoice(checked: boolean) {
    setMultiChoice(checked);
    const nextType = checked ? "MULTI_CHOICE" : "SINGLE_CHOICE";
    if (localPoll.type === "SINGLE_CHOICE" || localPoll.type === "MULTI_CHOICE") {
      try {
        await patchPoll(eventId, poll.id, { type: nextType });
        setLocalPoll((p) => ({ ...p, type: nextType }));
        onRefresh();
      } catch {
        toast.error("保存失败");
      }
    }
  }

  async function saveDraft() {
    setSavingDraft(true);
    try {
      await patchPoll(eventId, poll.id, { status: "DRAFT" });
      toast.success("已保存草稿");
      onRefresh();
    } catch {
      toast.error("保存失败");
    } finally {
      setSavingDraft(false);
    }
  }

  const isVoteType =
    localPoll.type === "SINGLE_CHOICE" || localPoll.type === "MULTI_CHOICE";

  const editor = (
    <>
      {paused ? (
        <div className="mb-4 rounded-xl border border-brand-amber/30 bg-brand-amber-light/40 px-4 py-3">
          <p className="text-sm font-medium text-brand-amber">已暂停 · 可编辑</p>
          <p className="mt-1 text-xs text-text-muted">
            参会者暂不可投票。可修改题目与选项，完成后点击「继续发布」。
          </p>
        </div>
      ) : null}

      <PollCreatorTypeTabs
        activeTab={activeTab}
        disabled={typeChanging || paused}
        onChange={(tab) => void handleTabChange(tab)}
      />

      <InteractionTitleInput
        eventId={eventId}
        pollId={poll.id}
        value={localPoll.title}
        placeholder="输入您的问题…"
        className="mb-2"
        onSaved={(title) => setLocalPoll((p) => ({ ...p, title }))}
      />

      {isVoteType && (
        <>
          <CreationSection hint="选项设置" className="py-8">
            <PollOptionsEditor
              key={`${poll.id}-${localPoll.type}`}
              eventId={eventId}
              pollId={poll.id}
              type={
                localPoll.type === "MULTI_CHOICE"
                  ? "MULTI_CHOICE"
                  : "SINGLE_CHOICE"
              }
              options={localPoll.options}
              onChange={(options) =>
                setLocalPoll((p) => ({ ...p, options }))
              }
            />
          </CreationSection>

          <CreationSection
            hint="结果呈现方式"
            description="大屏与参会者端展示投票结果时的视觉风格"
            className="py-8"
          >
            <PollResultVisualPicker
              value={resultVisual}
              onChange={(v) => void persistResultVisual(v)}
            />
          </CreationSection>
        </>
      )}

      {localPoll.type === "RATING" && (
        <CreationSection hint="评分设置" className="py-8">
          <RatingPollEditor
            key={`${poll.id}-rating`}
            eventId={eventId}
            pollId={poll.id}
            options={localPoll.options}
            onChange={(options) =>
              setLocalPoll((p) => ({ ...p, options }))
            }
          />
        </CreationSection>
      )}

      {localPoll.type === "WORD_CLOUD" && (
        <CreationSection hint="词云说明" className="py-8">
          <WordCloudEditor />
        </CreationSection>
      )}

      {localPoll.type === "QNA" && (
        <CreationSection
          hint="问答设置"
          description="参会者可在移动端提交问题；发布后在此审核、置顶与上屏展示。"
          className="py-8"
        >
          <p className="text-sm leading-relaxed text-text-muted">
            无需预设选项。发布后将进入问答控制台，实时查看并管理参会者提问。
          </p>
        </CreationSection>
      )}

      <InteractionSettings
        sessions={sessions}
        showResults={localPoll.showResults ?? true}
        multiChoice={isVoteType ? multiChoice : undefined}
        onMultiChoiceChange={isVoteType ? toggleMultiChoice : undefined}
        onShowResultsChange={async (checked) => {
          await patchPoll(eventId, poll.id, { showResults: checked });
          setLocalPoll((p) => ({ ...p, showResults: checked }));
        }}
      />
    </>
  );

  const footer = (
    <div className="flex items-center justify-between gap-4">
      {paused ? (
        <button
          type="button"
          onClick={onStop}
          className="text-base text-brand-red hover:underline disabled:opacity-50"
        >
          结束投票
        </button>
      ) : (
        <button
          type="button"
          disabled={savingDraft}
          onClick={() => void saveDraft()}
          className="text-base text-text-muted hover:text-text-primary disabled:opacity-50"
        >
          {savingDraft ? "保存中…" : "保存草稿"}
        </button>
      )}
      <Button
        size="lg"
        className="h-12 min-w-[140px] bg-brand-green text-base font-semibold text-white hover:bg-brand-green/90"
        onClick={onActivate}
      >
        {paused ? "继续发布" : "发布"}
      </Button>
    </div>
  );

  return (
    <InteractionEditLayout
      editor={editor}
      preview={
        <MobilePreview poll={localPoll} resultVisual={resultVisual} />
      }
      footer={footer}
    />
  );
}
