import { Suspense } from "react";
import { AdminLeadsClient } from "@/components/expo/AdminLeadsClient";

export default async function AdminLeadsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">加载全场线索…</p>}>
      <AdminLeadsClient eventId={eventId} />
    </Suspense>
  );
}
