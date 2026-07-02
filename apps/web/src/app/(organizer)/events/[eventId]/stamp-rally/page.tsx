import dynamic from "next/dynamic";
import { EventType } from "@connectiq/database";
import { notFound, redirect } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";

const StampRallyHubClient = dynamic(
  () =>
    import("@/components/stamp-rally/StampRallyHubClient").then(
      (mod) => mod.StampRallyHubClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="text-sm text-text-muted">集章打卡加载中…</p>
      </div>
    ),
  },
);

export default async function OrganizerStampRallyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  let access;
  try {
    access = await requireEventAccessCheck(eventId);
  } catch (error) {
    console.error("[stamp-rally] access check failed:", error);
    throw error;
  }

  if ("error" in access) notFound();

  const event = access.event;

  const isConferenceOrExpo =
    event.type === EventType.CONFERENCE ||
    event.type === EventType.EXPO ||
    event.activityType === "CONFERENCE" ||
    event.activityType === "EXPO";

  if (!isConferenceOrExpo) {
    redirect(`/events/${eventId}`);
  }

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="stampRally"
      title="集章打卡"
      description="管理集章路线与实时监控"
    >
      <StampRallyHubClient eventId={eventId} eventName={event.name} />
    </FeatureFlagGate>
  );
}
