import { Suspense } from "react";
import { PollVotingBigScreenClient } from "@/components/bigscreen/PollVotingBigScreenClient";

export default async function PollDisplayPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#12121e] text-white/50">
          加载投票大屏…
        </div>
      }
    >
      <PollVotingBigScreenClient eventId={eventId} />
    </Suspense>
  );
}
