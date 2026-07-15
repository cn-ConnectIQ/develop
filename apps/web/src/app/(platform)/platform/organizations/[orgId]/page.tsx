import { PlatformOrganizationDetailClient } from "@/components/platform/PlatformOrganizationDetailClient";

export default async function PlatformOrganizationDetailPage({
  params,
}: {
  params: Promise<{ orgId: string }> | { orgId: string };
}) {
  const resolved = await Promise.resolve(params);
  return <PlatformOrganizationDetailClient orgId={resolved.orgId} />;
}
