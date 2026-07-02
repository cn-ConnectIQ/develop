import dynamic from "next/dynamic";
import { EventType } from "@connectiq/database";
import { notFound, redirect } from "next/navigation";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";

const StampRallyConfigurator = dynamic(
  () =>
    import("@/components/stamp/StampRallyConfigurator").then(
      (mod) => mod.StampRallyConfigurator,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="text-sm text-text-muted">配置页加载中…</p>
      </div>
    ),
  },
);

export default async function NewStampRallyPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const access = await requireEventAccessCheck(eventId);
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
      title="新建集章打卡"
      description="配置全场集章打卡路线"
    >
      <StampRallyConfigurator
        eventId={eventId}
        eventName={event.name}
        mode="create"
      />
    </FeatureFlagGate>
  );
}
