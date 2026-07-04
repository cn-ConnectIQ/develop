import Link from "next/link";
import { Gift, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

type ParticipantLotteryEmptyStateProps = {
  eventId: string;
  onCreate?: () => void;
};

export function ParticipantLotteryEmptyState({
  eventId,
  onCreate,
}: ParticipantLotteryEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-6 py-16 text-center shadow-sm">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-secondary">
        <Gift className="size-7 text-text-tertiary" strokeWidth={1.5} />
      </div>
      <p className="mt-4 max-w-sm text-sm text-text-secondary">
        还没有参与人抽奖，为展位配置一个快速获客工具
      </p>
      {onCreate ? (
        <button
          type="button"
          className={buttonVariants({
            variant: "default",
            className: "mt-6 shadow-sm",
          })}
          onClick={onCreate}
        >
          <Plus data-icon="inline-start" />
          新建抽奖
        </button>
      ) : (
        <Link
          href={`/events/${eventId}/lottery/participant`}
          className={buttonVariants({
            variant: "default",
            className: "mt-6 shadow-sm",
          })}
        >
          <Plus data-icon="inline-start" />
          新建抽奖
        </Link>
      )}
    </div>
  );
}
