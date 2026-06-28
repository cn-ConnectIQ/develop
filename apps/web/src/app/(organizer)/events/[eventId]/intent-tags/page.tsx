import { AdminContent, AdminHeader, AdminPage } from "@/components/admin/admin-header";
import { ExpoTagsClient } from "@/components/expo/ExpoTagsClient";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function EventIntentTagsPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true },
  });

  if (!event) notFound();

  return (
    <AdminPage>
      <AdminHeader
        title="意向标签"
        description={event.name}
        breadcrumb={["活动", "意向标签"]}
      />
      <AdminContent>
        <ExpoTagsClient eventId={eventId} eventName={event.name} />
      </AdminContent>
    </AdminPage>
  );
}
