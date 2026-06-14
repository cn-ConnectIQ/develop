"use client";

import { useCallback, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  CheckCircle2,
  Gift,
  Loader2,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PhoneAuthSheet } from "@/app/i/[sessionCode]/PhoneAuthSheet";
import { POLL_TYPE_LABELS } from "@/lib/interactions";
import { cn } from "@/lib/utils";

type PollOption = { id: string; text: string; displayOrder: number };
type PollData = {
  id: string;
  title: string;
  type: string;
  status: string;
  closesAt: string | null;
  options: PollOption[];
  _count: { responses: number };
};

type LotteryData = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  entryCount: number;
  prizes: unknown;
};

type InteractionItem =
  | { type: "poll"; data: PollData }
  | { type: "lottery"; data: LotteryData };

export type InteractionPagePayload = {
  session: {
    id: string;
    name: string;
    sessionCode: string;
    participantCount: number;
  };
  event: { id: string; name: string; location: string | null };
  booth: { id: string; name: string; code: string } | null;
  interactions: InteractionItem[];
};

export function InteractionClient({
  sessionCode,
  initialData,
}: {
  sessionCode: string;
  initialData: InteractionPagePayload;
}) {
  const { data: authSession, status, update } = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [textAnswer, setTextAnswer] = useState("");
  const [rating, setRating] = useState(0);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const primary = initialData.interactions[0];
  const isLoggedIn = status === "authenticated" && !!authSession?.user;

  const requireAuth = useCallback(
    (action: () => void) => {
      if (isLoggedIn) {
        action();
        return;
      }
      setPendingAction(() => action);
      setAuthOpen(true);
    },
    [isLoggedIn],
  );

  async function participate(
    pollResponse?: Record<string, unknown>,
  ) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/i/${sessionCode}/participate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poll_response: pollResponse,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "参与失败");
        return false;
      }
      return true;
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePollSubmit(poll: PollData) {
    if (poll.status !== "LIVE") {
      toast.error("投票未开放");
      return;
    }

    let pollResponse: Record<string, unknown> = { poll_id: poll.id };

    if (poll.type === "SINGLE_CHOICE") {
      if (selectedOptions.length !== 1) {
        toast.error("请选择一个选项");
        return;
      }
      pollResponse.option_id = selectedOptions[0];
    } else if (poll.type === "MULTI_CHOICE") {
      if (selectedOptions.length === 0) {
        toast.error("请至少选择一个选项");
        return;
      }
      pollResponse.option_ids = selectedOptions;
    } else if (poll.type === "WORD_CLOUD" || poll.type === "QNA") {
      if (!textAnswer.trim()) {
        toast.error("请输入内容");
        return;
      }
      pollResponse.text_answer = textAnswer.trim();
    } else if (poll.type === "RATING") {
      if (rating < 1) {
        toast.error("请选择评分");
        return;
      }
      pollResponse.rating = rating;
    }

    const ok = await participate(pollResponse);
    if (ok) {
      setSubmitted(true);
      toast.success("提交成功，感谢参与！");
    }
  }

  async function handleLotteryJoin(lottery: LotteryData) {
    if (lottery.status !== "OPEN") {
      toast.error("抽奖未开放");
      return;
    }
    const ok = await participate();
    if (ok) {
      setSubmitted(true);
      toast.success("已成功参与抽奖，请等待开奖！");
    }
  }

  function onAuthSuccess() {
    void update();
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  }

  function toggleOption(optionId: string, multi: boolean) {
    if (multi) {
      setSelectedOptions((prev) =>
        prev.includes(optionId)
          ? prev.filter((id) => id !== optionId)
          : [...prev, optionId],
      );
    } else {
      setSelectedOptions([optionId]);
    }
  }

  return (
    <div className="min-h-dvh bg-content-bg pb-8">
      <header className="border-b border-border-light bg-white px-5 py-4">
        <p className="text-xs text-text-muted">{initialData.event.name}</p>
        {initialData.booth && (
          <p className="mt-0.5 text-xs text-brand-amber">
            {initialData.booth.name} · {initialData.booth.code}
          </p>
        )}
        <h1 className="mt-2 text-lg font-bold leading-snug">
          {initialData.session.name}
        </h1>
        <p className="mt-1 text-xs text-text-muted">
          {initialData.session.participantCount} 人已参与
        </p>
      </header>

      <main className="px-4 pt-5">
        {!primary && (
          <p className="text-center text-sm text-text-muted">暂无可参与的互动</p>
        )}

        {primary?.type === "poll" && (
          <PollPanel
            poll={primary.data}
            submitted={submitted}
            submitting={submitting}
            selectedOptions={selectedOptions}
            textAnswer={textAnswer}
            rating={rating}
            onToggleOption={toggleOption}
            onTextChange={setTextAnswer}
            onRatingChange={setRating}
            onSubmit={() =>
              requireAuth(() => void handlePollSubmit(primary.data))
            }
          />
        )}

        {primary?.type === "lottery" && (
          <LotteryPanel
            lottery={primary.data}
            submitted={submitted}
            submitting={submitting}
            onJoin={() =>
              requireAuth(() => void handleLotteryJoin(primary.data))
            }
          />
        )}
      </main>

      <PhoneAuthSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        onSuccess={onAuthSuccess}
      />
    </div>
  );
}

function PollPanel({
  poll,
  submitted,
  submitting,
  selectedOptions,
  textAnswer,
  rating,
  onToggleOption,
  onTextChange,
  onRatingChange,
  onSubmit,
}: {
  poll: PollData;
  submitted: boolean;
  submitting: boolean;
  selectedOptions: string[];
  textAnswer: string;
  rating: number;
  onToggleOption: (id: string, multi: boolean) => void;
  onTextChange: (v: string) => void;
  onRatingChange: (v: number) => void;
  onSubmit: () => void;
}) {
  const typeLabel = POLL_TYPE_LABELS[poll.type] ?? "投票";
  const isMulti = poll.type === "MULTI_CHOICE";
  const showOptions =
    poll.type === "SINGLE_CHOICE" || poll.type === "MULTI_CHOICE";
  const isClosed = poll.status === "CLOSED" || poll.status === "DRAFT";

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border-light bg-white p-8 text-center">
        <CheckCircle2 className="mx-auto size-12 text-brand-green" />
        <p className="mt-4 font-semibold">感谢参与！</p>
        <p className="mt-1 text-sm text-text-muted">您的回答已成功提交</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-light bg-white p-5 shadow-sm">
      <span className="rounded-full bg-brand-blue-light px-2.5 py-0.5 text-xs font-medium text-brand-blue">
        {typeLabel}
      </span>
      <h2 className="mt-3 text-base font-semibold leading-snug">{poll.title}</h2>
      <p className="mt-1 text-xs text-text-muted">
        {poll._count.responses} 人已参与
      </p>

      {showOptions && (
        <div className="mt-5 space-y-2">
          {poll.options.map((option) => {
            const selected = selectedOptions.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={isClosed || submitting}
                onClick={() => onToggleOption(option.id, isMulti)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-sm transition-colors",
                  selected
                    ? "border-brand-blue bg-brand-blue-light text-brand-blue"
                    : "border-border-light hover:border-brand-blue/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                    selected
                      ? "border-brand-blue bg-brand-blue text-white"
                      : "border-border-light",
                  )}
                >
                  {selected && <CheckCircle2 className="size-3.5" />}
                </span>
                {option.text}
              </button>
            );
          })}
        </div>
      )}

      {(poll.type === "WORD_CLOUD" || poll.type === "QNA") && (
        <Textarea
          className="mt-5 min-h-[120px] resize-none"
          placeholder={
            poll.type === "WORD_CLOUD" ? "输入一个词或短语..." : "输入您的问题..."
          }
          value={textAnswer}
          onChange={(e) => onTextChange(e.target.value)}
          disabled={isClosed || submitting}
        />
      )}

      {poll.type === "RATING" && (
        <div className="mt-6 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              disabled={isClosed || submitting}
              onClick={() => onRatingChange(value)}
              className="p-1"
            >
              <Star
                className={cn(
                  "size-9 transition-colors",
                  value <= rating
                    ? "fill-brand-amber text-brand-amber"
                    : "text-border-light",
                )}
              />
            </button>
          ))}
        </div>
      )}

      <Button
        className="mt-6 h-11 w-full rounded-xl bg-brand-blue hover:bg-brand-blue/90"
        disabled={isClosed || submitting}
        onClick={onSubmit}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            提交中...
          </>
        ) : isClosed ? (
          "投票未开放"
        ) : (
          "提交"
        )}
      </Button>
    </div>
  );
}

function LotteryPanel({
  lottery,
  submitted,
  submitting,
  onJoin,
}: {
  lottery: LotteryData;
  submitted: boolean;
  submitting: boolean;
  onJoin: () => void;
}) {
  const isOpen = lottery.status === "OPEN";

  if (submitted) {
    return (
      <div className="rounded-2xl border border-border-light bg-white p-8 text-center">
        <Gift className="mx-auto size-12 text-brand-amber" />
        <p className="mt-4 font-semibold">参与成功！</p>
        <p className="mt-1 text-sm text-text-muted">
          您已加入抽奖池，请留意现场开奖
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border-light bg-white p-5 shadow-sm">
      <span className="rounded-full bg-brand-amber-light px-2.5 py-0.5 text-xs font-medium text-brand-amber">
        现场抽奖
      </span>
      <h2 className="mt-3 text-base font-semibold">{lottery.title}</h2>
      {lottery.description && (
        <p className="mt-2 text-sm text-text-muted">{lottery.description}</p>
      )}
      <p className="mt-3 text-xs text-text-muted">
        {lottery.entryCount} 人已参与
      </p>

      <Button
        className="mt-6 h-11 w-full rounded-xl bg-brand-amber text-white hover:bg-brand-amber/90"
        disabled={!isOpen || submitting}
        onClick={onJoin}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            参与中...
          </>
        ) : isOpen ? (
          "立即参与抽奖"
        ) : (
          "抽奖未开放"
        )}
      </Button>
    </div>
  );
}
