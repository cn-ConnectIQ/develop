import { EventType, prisma } from "@connectiq/database";
import { notFound, redirect } from "next/navigation";
import { ExpoOverviewSections } from "@/components/expo/ExpoOverviewSections";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";

export default async function ExpoSettingsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, type: true, activityType: true },
  });

  if (!event) notFound();

  const isExpo =
    event.type === EventType.EXPO || event.activityType === "EXPO";
  if (!isExpo) {
    redirect(`/events/${eventId}`);
  }

  return (
    <AdminPage>
      <AdminHeader
        title="展会配置"
        description={event.name}
        breadcrumb={["活动", "展会配置"]}
      />
      <AdminContent>
        <ExpoOverviewSections expoId={eventId} />
      </AdminContent>
    </AdminPage>
  );
}
