import type { Metadata } from "next";
import { OrgPublicPageClient } from "@/components/org-public/OrgPublicPageClient";
import { getOrgPublicPageMeta } from "@/lib/org-public-meta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = await getOrgPublicPageMeta(slug);
  if (!meta) {
    return { title: "组织不存在 | ConnectIQ" };
  }
  return meta;
}

export default async function OrgPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <OrgPublicPageClient slug={slug} />;
}
