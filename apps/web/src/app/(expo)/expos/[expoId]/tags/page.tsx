import { AdminContent, AdminHeader, AdminPage } from "@/components/admin/admin-header";
import { ExpoTagsClient } from "@/components/expo/ExpoTagsClient";
import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";

export default async function ExpoTagsPage({
  params,
}: {
  params: Promise<{ expoId: string }>;
}) {
  const { expoId } = await params;

  const expo = await prisma.event.findUnique({
    where: { id: expoId },
    select: { id: true, name: true },
  });

  if (!expo) notFound();

  return (
    <AdminPage>
      <AdminHeader
        title="意向标签"
        description={expo.name}
        breadcrumb={["展会", "意向标签"]}
      />
      <AdminContent>
        <ExpoTagsClient eventId={expoId} eventName={expo.name} />
      </AdminContent>
    </AdminPage>
  );
}
