import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import {
  ExhibitorBoothLeadsClient,
  type ExhibitorLeadRow,
} from "@/components/exhibitor/ExhibitorBoothLeadsClient";

export default async function ExhibitorBoothLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ boothId: string }>;
  searchParams: Promise<{ grade?: string; status?: string }>;
}) {
  const { boothId } = await params;
  const { grade, status } = await searchParams;

  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      code: true,
      event: { select: { name: true, id: true } },
    },
  });

  if (!booth) notFound();

  const leads = await prisma.lead.findMany({
    where: {
      boothId,
      ...(status === "followup"
        ? { status: { in: ["NEW", "CONTACTED"] } }
        : {}),
      ...(grade === "A"
        ? {
            intentTags: {
              some: {
                intentTag: {
                  OR: [
                    { label: { contains: "采购" } },
                    { label: { contains: "投资" } },
                  ],
                },
              },
            },
          }
        : {}),
    },
    include: {
      participant: {
        select: { name: true, company: true, email: true, phone: true },
      },
      intentTags: { include: { intentTag: { select: { label: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const title =
    grade === "A"
      ? "A 级线索"
      : status === "followup"
        ? "待跟进"
        : "来访客户列表";

  const serialized: ExhibitorLeadRow[] = leads.map((lead) => ({
    id: lead.id,
    status: lead.status,
    crmSyncStatus: lead.crmSyncStatus,
    crmSyncError: lead.crmSyncError,
    createdAt: lead.createdAt.toISOString(),
    participant: lead.participant,
    intentTags: lead.intentTags,
  }));

  return (
    <ExhibitorBoothLeadsClient
      boothId={booth.id}
      boothCode={booth.code}
      eventName={booth.event.name}
      title={title}
      leads={serialized}
    />
  );
}
