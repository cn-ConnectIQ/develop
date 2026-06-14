"use client";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { pollTypeLabel } from "@/lib/bigscreen-display";
import type { QnaQuestion } from "@/lib/bigscreen-display";
import type { BigscreenData, BigscreenPoll } from "@/lib/bigscreen-types";

type BigscreenHostPanelProps = {
  poll: BigscreenPoll | null;
  data: BigscreenData | undefined;
  countdown: string;
  showResults: boolean;
  onShowResultsChange: (value: boolean) => void;
  onPatchPoll: (pollId: string, body: Record<string, unknown>) => void;
  onPatchDisplay: (
    pollId: string,
    body: Record<string, unknown>,
  ) => Promise<void>;
};

export function BigscreenHostPanel({
  poll,
  data,
  countdown,
  showResults,
  onShowResultsChange,
  onPatchPoll,
  onPatchDisplay,
}: BigscreenHostPanelProps) {
  const qnaQuestions = (data?.qnaQuestions ?? []).filter((q) => !q.hidden);
  const isQna = poll?.type === "QNA";

  return (
    <aside className="flex w-[30%] flex-col gap-4 border-l border-white/10 bg-[#2D3561] p-6 text-white">
      <h2 className="text-sm font-semibold text-white/80">主持人控制台</h2>

      {poll ? (
        <>
          <div className="rounded-lg bg-white/5 p-4">
            <p className="truncate text-sm text-white">{poll.title}</p>
            <span className="mt-2 inline-block rounded-full bg-brand-green px-2 py-0.5 text-xs text-white">
              进行中
            </span>
            <p className="mt-3 font-mono text-2xl font-bold text-brand-amber">
              {countdown}
            </p>
            <p className="mt-1 text-sm text-white/60">
              {data?.results?.total ?? poll.responseCount} / 约{" "}
              {data?.stats.participants ?? 0} 人
            </p>
          </div>

          <div className="space-y-2">
            <Button
              className="h-12 w-full rounded-lg bg-brand-amber text-white hover:bg-brand-amber/90"
              onClick={() => onPatchPoll(poll.id, { status: "PAUSED" })}
            >
              暂停投票
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full rounded-lg border-brand-red text-brand-red hover:bg-brand-red/10"
              onClick={() => onPatchPoll(poll.id, { status: "CLOSED" })}
            >
              结束本轮
            </Button>
            <Button
              className="h-12 w-full rounded-lg bg-white/10 text-white hover:bg-white/20"
              onClick={() => onPatchPoll(poll.id, { extendMinutes: 2 })}
            >
              延长 2 分钟
            </Button>
          </div>

          <div className="my-2 border-t border-white/10" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">显示/隐藏实时结果</p>
              <p className="text-xs text-white/40">
                关闭后投影屏不显示当前票数
              </p>
            </div>
            <Switch
              checked={showResults}
              onCheckedChange={(v) => {
                onShowResultsChange(v);
                void onPatchDisplay(poll.id, { showResults: v });
              }}
            />
          </div>

          {isQna && (
            <QnaManageList
              questions={qnaQuestions}
              onAction={(body) => onPatchDisplay(poll.id, body)}
            />
          )}
        </>
      ) : (
        <p className="text-sm text-white/50">等待发布互动…</p>
      )}

      <QueueSection
        next={data?.queue.next ?? null}
        drafts={data?.queue.drafts ?? []}
        onPublish={(id) => onPatchPoll(id, { status: "LIVE" })}
      />

      <p className="mt-auto pt-4 text-xs text-white/40">
        签到 {data?.stats.checkedIn ?? 0} · 在场 {data?.stats.onSite ?? 0} ·
        参与率 {data?.stats.participationRate ?? 0}%
      </p>
    </aside>
  );
}

function QueueSection({
  next,
  drafts,
  onPublish,
}: {
  next: BigscreenData["queue"]["next"];
  drafts: BigscreenData["queue"]["drafts"];
  onPublish: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-white/50">互动队列</p>
      <ul className="space-y-2 text-sm">
        {next && (
          <li className="flex items-center justify-between rounded bg-white/5 px-3 py-2">
            <span className="truncate text-white/80">
              下一个：{next.title}
              <span className="ml-1 text-xs text-white/40">
                ({pollTypeLabel(next.type)})
              </span>
            </span>
            <button
              type="button"
              className="shrink-0 text-sm text-brand-green"
              onClick={() => onPublish(next.id)}
            >
              立即发布
            </button>
          </li>
        )}
        {drafts.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded bg-white/5 px-3 py-2"
          >
            <span className="truncate text-white/60">草稿：{item.title}</span>
            <button
              type="button"
              className="shrink-0 text-sm text-white/60 hover:text-white"
              onClick={() => onPublish(item.id)}
            >
              发布
            </button>
          </li>
        ))}
        {!next && drafts.length === 0 && (
          <li className="text-xs text-white/40">暂无排队互动</li>
        )}
      </ul>
    </div>
  );
}

function QnaManageList({
  questions,
  onAction,
}: {
  questions: QnaQuestion[];
  onAction: (body: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="mb-2 text-xs font-medium text-white/50">Q&A 管理</p>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {questions.map((q) => (
          <li
            key={q.id}
            className="flex items-start justify-between gap-2 border-b border-white/10 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-white">{q.text}</p>
              <p className="mt-0.5 text-xs text-white/60">{q.likes} 赞</p>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 text-xs">
              {!q.featured && (
                <button
                  type="button"
                  className="text-brand-blue"
                  onClick={() =>
                    void onAction({ featuredResponseId: q.id })
                  }
                >
                  上屏
                </button>
              )}
              <button
                type="button"
                className="text-white/60"
                onClick={() =>
                  void onAction(
                    q.pinned
                      ? { unpinResponseId: q.id }
                      : { pinResponseId: q.id },
                  )
                }
              >
                {q.pinned ? "取消置顶" : "置顶"}
              </button>
              <button
                type="button"
                className="text-white/60"
                onClick={() => void onAction({ hideResponseId: q.id })}
              >
                隐藏
              </button>
              {q.answered ? (
                <span className="text-brand-green">✓ 已回答</span>
              ) : (
                <button
                  type="button"
                  className="text-brand-green"
                  onClick={() =>
                    void onAction({ markAnsweredResponseId: q.id })
                  }
                >
                  ✓ 已回答
                </button>
              )}
            </div>
          </li>
        ))}
        {questions.length === 0 && (
          <li className="py-4 text-xs text-white/40">暂无提问</li>
        )}
      </ul>
    </div>
  );
}
