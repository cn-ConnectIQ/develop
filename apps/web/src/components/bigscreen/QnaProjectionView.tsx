import type { QnaQuestion } from "@/lib/bigscreen-display";

type QnaProjectionViewProps = {
  question: QnaQuestion | null;
};

export function QnaProjectionView({ question }: QnaProjectionViewProps) {
  if (!question) {
    return (
      <div className="flex flex-1 items-center justify-center px-12 pb-24">
        <p className="text-2xl text-white/40">等待观众提问…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-12 pb-24">
      <div className="max-w-3xl rounded-2xl bg-white/5 px-12 py-16 text-center">
        <p className="text-[32px] leading-snug font-bold text-white">
          {question.text}
        </p>
        {question.likes > 1 && (
          <p className="mt-6 text-sm text-white/50">{question.likes} 人关注</p>
        )}
      </div>
    </div>
  );
}
