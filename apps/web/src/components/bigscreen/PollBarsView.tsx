import type { PollOptionResult } from "@/lib/bigscreen-types";

type PollBarsViewProps = {
  options: PollOptionResult[];
};

export function PollBarsView({ options }: PollBarsViewProps) {
  return (
    <div className="flex-1 space-y-4 px-12 pb-24">
      {options.map((option) => (
        <div key={option.id}>
          <div className="mb-2 flex justify-between text-white">
            <span className="text-[18px]">{option.text}</span>
            <span className="text-[18px] tabular-nums">
              {option.percentage}% · {option.count} 票
            </span>
          </div>
          <div className="h-[52px] overflow-hidden rounded-lg bg-white/10">
            <div
              className="h-full rounded-lg bg-gradient-to-r from-[#185FA5] to-[#3A7FD5] transition-all duration-500"
              style={{ width: `${Math.max(option.percentage, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
