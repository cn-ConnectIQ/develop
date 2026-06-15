import { Suspense } from "react";
import { InteractionsManagerClient } from "@/components/interactions/InteractionsManagerClient";

export default async function InteractionsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-56px)] items-center justify-center text-sm text-text-muted">
          加载中…
        </div>
      }
    >
      <InteractionsManagerClient eventId={eventId} />
    </Suspense>
  );
}
