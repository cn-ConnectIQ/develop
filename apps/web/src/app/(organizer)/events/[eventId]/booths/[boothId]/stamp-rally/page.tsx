import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { FeatureFlagGate } from "@/components/events/FeatureFlagGate";
import { BoothStampRallyConfigurator } from "@/components/stamp/BoothStampRallyConfigurator";

/** 登录由 middleware 保证；不再用 access check → notFound 假 404。 */
export default async function BoothStampRallyPage({
  params,
}: {
  params: Promise<{ eventId: string; boothId: string }>;
}) {
  const { eventId, boothId } = await params;

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { id: boothId, eventId },
    select: {
      id: true,
      code: true,
      name: true,
      companyOrg: { select: { name: true } },
      event: { select: { id: true, name: true } },
    },
  });

  if (!booth) notFound();

  return (
    <FeatureFlagGate
      eventId={eventId}
      flag="stampRally"
      title="展位集章打卡"
      description="在大展位内设置多个区域打卡点"
    >
      <BoothStampRallyConfigurator
        eventId={eventId}
        boothId={booth.id}
        boothCode={booth.code}
        boothName={booth.name}
        companyName={booth.companyOrg.name}
      />
    </FeatureFlagGate>
  );
}
