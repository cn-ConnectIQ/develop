import { Suspense } from "react";
import { ScanPageClient } from "@/components/checkin/ScanPageClient";

export default async function EventScanPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">加载扫码页…</p>}>
      <ScanPageClient eventId={eventId} />
    </Suspense>
  );
}
