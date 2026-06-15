import { Suspense } from "react";
import { InteractionsBigscreenClient } from "@/components/interactions/bigscreen/InteractionsBigscreenClient";

export default async function InteractionsBigscreenPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center bg-[#1A1A2E] text-white/60">
          加载大屏…
        </div>
      }
    >
      <InteractionsBigscreenClient eventId={eventId} />
    </Suspense>
  );
}
