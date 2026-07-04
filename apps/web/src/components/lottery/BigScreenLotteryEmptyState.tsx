import Link from "next/link";
import { MonitorPlay, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export function BigScreenLotteryEmptyState({ eventId }: { eventId: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-surface px-6 py-16 text-center shadow-sm">
      <div className="flex size-14 items-center justify-center rounded-full bg-surface-secondary">
        <MonitorPlay className="size-7 text-text-tertiary" strokeWidth={1.5} />
      </div>
      <p className="mt-4 max-w-sm text-sm text-text-secondary">
        还没有大屏抽奖，创建一个为活动收尾增加仪式感
      </p>
      <Link
        href={`/events/${eventId}/lottery/big-screen/new`}
        className={buttonVariants({
          variant: "default",
          className: "mt-6 shadow-sm",
        })}
      >
        <Plus data-icon="inline-start" />
        新建大屏抽奖
      </Link>
    </div>
  );
}
