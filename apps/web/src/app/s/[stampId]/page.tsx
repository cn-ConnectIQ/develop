import { prisma } from "@connectiq/database";
import { notFound } from "next/navigation";
import { MapPin } from "lucide-react";

export default async function StampScanLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ stampId: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { stampId } = await params;
  const { code } = await searchParams;

  const stamp = await prisma.stamp.findUnique({
    where: { id: stampId },
    include: {
      rally: {
        select: {
          name: true,
          prize: true,
          booth: { select: { code: true, name: true } },
        },
      },
    },
  });

  if (!stamp) notFound();

  const valid = !code || stamp.scanCode === code.trim();
  const boothLabel =
    stamp.rally.booth?.code ?? stamp.rally.booth?.name ?? "展位";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-brand-blue-light/30 to-white px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border-light bg-white p-8 text-center shadow-lg">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-blue-light">
          <span className="text-3xl">{stamp.icon ?? "📍"}</span>
        </div>
        <h1 className="mt-4 text-xl font-bold text-[var(--admin-ink)]">
          {stamp.name}
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          {boothLabel} · {stamp.rally.name}
        </p>
        {!valid && (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            二维码无效或已过期，请联系展位工作人员
          </p>
        )}
        {valid && (
          <>
            <p className="mt-4 text-sm text-text-muted">
              请使用 ConnectIQ 小程序扫描此码完成集章
            </p>
            <p className="mt-2 text-xs text-brand-gold">
              完成集章可兑换：{stamp.rally.prize}
            </p>
          </>
        )}
        <div className="mt-6 flex items-center justify-center gap-1 text-xs text-text-tertiary">
          <MapPin className="size-3.5" />
          ConnectIQ 集章打卡
        </div>
      </div>
    </main>
  );
}
