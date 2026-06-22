import { AdminStatus, prisma } from "@connectiq/database";

const APP_BASE =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXTAUTH_URL ??
  "https://app.connectiq.cn";

function absoluteAssetUrl(path: string | null | undefined) {
  if (!path) return undefined;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${APP_BASE.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/** 公开组织页 SEO 元数据（服务端） */
export async function getOrgPublicPageMeta(slug: string) {
  const org = await prisma.organization.findFirst({
    where: { slug, adminStatus: AdminStatus.APPROVED },
    select: {
      name: true,
      slug: true,
      bio: true,
      logoUrl: true,
      coverUrl: true,
      industry: true,
      headquarters: true,
    },
  });

  if (!org) return null;

  const description =
    org.bio?.trim().slice(0, 160) ||
    [org.name, org.industry, org.headquarters].filter(Boolean).join(" · ") ||
    `${org.name} 在 ConnectIQ 的官方组织主页`;

  const image = absoluteAssetUrl(org.coverUrl ?? org.logoUrl);
  const pageUrl = `${APP_BASE.replace(/\/$/, "")}/org/${org.slug}`;

  return {
    title: `${org.name} | ConnectIQ`,
    description,
    openGraph: {
      title: org.name,
      description,
      url: pageUrl,
      type: "website" as const,
      siteName: "ConnectIQ",
      ...(image ? { images: [{ url: image, alt: org.name }] } : {}),
    },
    twitter: {
      card: "summary_large_image" as const,
      title: org.name,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}
