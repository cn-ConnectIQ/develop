import { PollVotingBar } from "@/components/bigscreen/PollVotingBar";
import type { PollOptionResult } from "@/lib/bigscreen-types";

type PollBarsViewProps = {
  options: PollOptionResult[];
};

function getWinnerId(options: PollOptionResult[]): string | null {
  if (options.length === 0) return null;
  let maxPct = -1;
  let winnerId: string | null = null;
  for (const opt of options) {
    if (opt.percentage > maxPct) {
      maxPct = opt.percentage;
      winnerId = opt.id;
    }
  }
  return maxPct > 0 ? winnerId : null;
}

/** PR5 条形赛跑（兼容旧引用） */
export function PollBarsView({ options }: PollBarsViewProps) {
  const winnerId = getWinnerId(options);

  return (
    <div className="flex flex-1 flex-col justify-center gap-4 px-[5%] pb-24">
      {options.map((option) => (
        <PollVotingBar
          key={option.id}
          label={option.text}
          percentage={option.percentage}
          isWinner={option.id === winnerId}
        />
      ))}
    </div>
  );
}
