"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart2,
  Copy,
  ExternalLink,
  Loader2,
  Monitor,
  MoreHorizontal,
  QrCode,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { QnaManager } from "@/components/interactions/QnaManager";
import { InteractionTitleInput } from "@/components/interactions/InteractionTitleInput";
import { InteractionSettings } from "@/components/interactions/InteractionSettings";
import { MobilePreview } from "@/components/interactions/MobilePreview";
import { RealtimeConsole } from "@/components/interactions/RealtimeConsole";
import { PollOptionsEditor } from "@/components/interactions/editors/PollOptionsEditor";
import { WordCloudEditor } from "@/components/interactions/editors/WordCloudEditor";
import { RatingEditor } from "@/components/interactions/editors/RatingEditor";
import { SurveyEditor } from "@/components/interactions/editors/SurveyEditor";
import { LotteryEditor } from "@/components/interactions/editors/LotteryEditor";
import { LotteryDrawPanel } from "@/components/interactions/LotteryDrawPanel";
import { InteractionQRDisplay } from "@/components/interactions/InteractionQRDisplay";
import { PushToAttendeesButton } from "@/components/interactions/PushToAttendeesButton";
import {
  isPollLive,
  type InteractionItem,
  type InteractionPollItem,
  type InteractionLotteryItem,
} from "@/lib/interaction-manager";
import { POLL_TYPE_BADGE, POLL_TYPE_LABELS } from "@/lib/interactions";
import type { SessionOption } from "@/lib/interactions";
import { patchPoll } from "@/hooks/useInteractionAutoSave";
import { parsePrizes, type LotteryDetail } from "@/lib/lottery-types";
import { cn } from "@/lib/utils";

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

  if (selection.kind === "poll" && selection.type === "QNA") {
    return (
      <QnaManager
        pollId={selection.id}
        eventId={eventId}
        pollStatus={selection.status}
        onStatusChange={onRefresh}
      />
    );
  }

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

  if (selection.kind === "lottery") {
    return (
      <LotteryWorkspace
        eventId={eventId}
        lottery={selection}
        onRefresh={onRefresh}
      />
    );
  }

  return (
    <PollEditWorkspace
      eventId={eventId}
      poll={selection}
      sessions={sessions}
      onRefresh={onRefresh}
      onDelete={() => onDelete(selection)}
      onActivate={() => onActivate(selection)}
    />
  );
}

function PollEditWorkspace({
  eventId,
  poll,
  sessions,
  onRefresh,
  onDelete,
  onActivate,
}: {
  eventId: string;
  poll: InteractionPollItem;
  sessions: SessionOption[];
  onRefresh: () => void;
  onDelete: () => void;
  onActivate: () => void;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrData, setQrData] = useState<{
    sessionCode: string;
    qrUrl: string;
  } | null>(null);
  const [creatingQr, setCreatingQr] = useState(false);
  const [localPoll, setLocalPoll] = useState(poll);

  useEffect(() => {
    setLocalPoll(poll);
  }, [poll.id]);

  async function createQrSession() {
    setCreatingQr(true);
    try {
      const res = await fetch(`/api/events/${eventId}/interaction-sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: poll.title,
          interactions: [{ type: "poll", id: poll.id }],
        }),
      });
      if (!res.ok) throw new Error("创建扫码会话失败");
      const json = await res.json();
      setQrData({
        sessionCode: json.data.session_code,
        qrUrl: json.data.qr_url,
      });
      setQrOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreatingQr(false);
    }
  }

  const badgeClass =
    POLL_TYPE_BADGE[poll.type] ?? "bg-content-bg text-text-muted";

  return (
    <div className="flex min-w-0 flex-1">
      <div className="min-w-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5 flex items-center gap-2">
          <span
            className={cn(
              "rounded px-2 py-0.5 text-xs font-medium",
              badgeClass,
            )}
          >
            {POLL_TYPE_LABELS[poll.type] ?? poll.type}
          </span>
          <div className="flex-1" />
          <span className="text-xs text-text-muted">自动保存 ✓</span>
          <PushToAttendeesButton
            eventId={eventId}
            kind="poll"
            targetId={poll.id}
          />
          <Button
            size="sm"
            className="h-8 rounded-lg bg-brand-blue px-4 text-xs text-white"
            onClick={onActivate}
          >
            激活
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-lg"
            onClick={() =>
              window.open(`/events/${eventId}/interactions/bigscreen`, "_blank")
            }
          >
            <Monitor className="size-4 text-text-muted" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-lg"
            disabled={creatingQr}
            onClick={() => void createQrSession()}
          >
            {creatingQr ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <QrCode className="size-4 text-text-muted" />
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="inline-flex size-8 items-center justify-center rounded-lg border border-border-light"
            >
              <MoreHorizontal className="size-4 text-text-muted" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={async () => {
                  const res = await fetch(
                    `/api/events/${eventId}/polls/${poll.id}/duplicate`,
                    { method: "POST" },
                  );
                  if (!res.ok) {
                    toast.error("复制失败");
                    return;
                  }
                  toast.success("已复制互动");
                  onRefresh();
                }}
              >
                <Copy className="mr-2 size-4" />
                复制
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={async () => {
                  await patchPoll(eventId, poll.id, { status: "DRAFT" });
                  onRefresh();
                }}
              >
                移入草稿
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-brand-red"
                onClick={onDelete}
              >
                <Trash2 className="mr-2 size-4" />
                删除
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <InteractionTitleInput
          eventId={eventId}
          pollId={poll.id}
          value={localPoll.title}
          onSaved={(title) => setLocalPoll((p) => ({ ...p, title }))}
        />

        <PollTypeEditor
          eventId={eventId}
          poll={localPoll}
          onOptionsChange={(options) =>
            setLocalPoll((p) => ({ ...p, options }))
          }
        />

        <InteractionSettings
          sessions={sessions}
          showResults={localPoll.showResults ?? true}
          qrUrl={qrData?.qrUrl}
          onShowResultsChange={async (checked) => {
            await patchPoll(eventId, poll.id, { showResults: checked });
            setLocalPoll((p) => ({ ...p, showResults: checked }));
          }}
        />
      </div>

      <MobilePreview poll={localPoll} />

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>扫码入口</DialogTitle>
          </DialogHeader>
          {qrData && (
            <InteractionQRDisplay
              sessionCode={qrData.sessionCode}
              qrUrl={qrData.qrUrl}
              interactionTitle={poll.title}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PollTypeEditor({
  eventId,
  poll,
  onOptionsChange,
}: {
  eventId: string;
  poll: InteractionPollItem;
  onOptionsChange: (options: Array<{ id: string; text: string }>) => void;
}) {
  if (poll.type === "SINGLE_CHOICE" || poll.type === "MULTI_CHOICE") {
    return (
      <PollOptionsEditor
        eventId={eventId}
        pollId={poll.id}
        type={poll.type}
        options={poll.options}
        onChange={onOptionsChange}
      />
    );
  }
  if (poll.type === "WORD_CLOUD") {
    return <WordCloudEditor />;
  }
  if (poll.type === "RATING") {
    return <RatingEditor />;
  }
  if (poll.type === "QNA") {
    return (
      <Textarea
        placeholder="问答说明（选填）"
        className="mt-4 rounded-xl border border-border-light text-sm"
        rows={3}
      />
    );
  }
  if (poll.type === "ANNOUNCEMENT") {
    return (
      <Textarea
        defaultValue={poll.options[0]?.text ?? ""}
        placeholder="公告内容"
        className="mt-4 rounded-xl border border-border-light text-sm"
        rows={4}
      />
    );
  }
  return <SurveyEditor eventId={eventId} pollId={poll.id} />;
}

function LotteryWorkspace({
  eventId,
  lottery,
  onRefresh,
}: {
  eventId: string;
  lottery: InteractionLotteryItem;
  onRefresh: () => void;
}) {
  const showDrawPanel =
    lottery.status === "DRAWING" || lottery.status === "OPEN";

  const { data: detail, isLoading } = useQuery({
    queryKey: ["lottery-detail", eventId, lottery.id],
    queryFn: async (): Promise<LotteryDetail> => {
      const res = await fetch(
        `/api/events/${eventId}/lotteries/${lottery.id}`,
      );
      if (!res.ok) throw new Error("加载抽奖失败");
      const json = await res.json();
      const d = json.data;
      return {
        id: d.id,
        eventId: d.eventId,
        title: d.title,
        description: d.description,
        type: d.type,
        status: d.status,
        prizes: parsePrizes(d.prizes),
        requireCheckin: d.requireCheckin ?? false,
        requirePollId: d.requirePollId ?? null,
        quizPollId: d.quizPollId ?? null,
        eligibleRoles: d.eligibleRoles ?? [],
        allowReenter: d.allowReenter ?? false,
        entryCount: d.entryCount ?? 0,
        winnerCount: d.winnerCount ?? 1,
        boothId: d.boothId,
      };
    },
  });

  if (isLoading || !detail) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-text-muted">
        加载抽奖配置…
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border-light px-6 py-3">
          <span className="rounded bg-brand-red-light px-2 py-0.5 text-xs font-medium text-brand-red">
            抽奖
          </span>
          <div className="flex-1" />
          <PushToAttendeesButton
            eventId={eventId}
            kind="lottery"
            targetId={lottery.id}
          />
          <Button
            variant="outline"
            size="icon"
            className="size-8 rounded-lg"
            onClick={() =>
              window.open(`/events/${eventId}/interactions/bigscreen`, "_blank")
            }
          >
            <Monitor className="size-4 text-text-muted" />
          </Button>
          <Link
            href={`/events/${eventId}/lottery`}
            className="inline-flex h-8 items-center rounded-lg border border-border-light px-3 text-sm text-text-muted hover:text-brand-blue"
          >
            <ExternalLink className="mr-1 size-3.5" />
            抽奖管理
          </Link>
        </div>
        <LotteryEditor
          lottery={detail}
          eventId={eventId}
          onChange={onRefresh}
        />
      </div>
      {(showDrawPanel || lottery.status === "FINISHED") && (
        <LotteryDrawPanel
          eventId={eventId}
          lotteryId={lottery.id}
          title={detail.title}
          entryCount={detail.entryCount}
          prizes={detail.prizes}
          onFinished={onRefresh}
        />
      )}
    </div>
  );
}
