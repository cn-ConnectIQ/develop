import type { Metadata } from "next";
import { EventStatus, prisma } from "@connectiq/database";
import { ENABLE_INTERNAL_SELF_REGISTER } from "@/lib/internal-self-register";
import { RegisterClient } from "./RegisterClient";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { name: true },
  });
  return {
    title: event ? `${event.name} · 报名` : "活动报名",
    robots: { index: false, follow: false },
  };
}

export default async function InternalSelfRegisterPage({ params }: PageProps) {
  if (!ENABLE_INTERNAL_SELF_REGISTER) {
    return (
      <ClosedState title="报名入口已关闭" description="请联系主办方获取正式报名方式。" />
    );
  }

  const { eventId } = await params;
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, name: true, status: true },
  });

  if (!event) {
    return (
      <ClosedState title="活动不存在" description="链接无效或活动已删除。" />
    );
  }

  if (
    event.status !== EventStatus.PUBLISHED &&
    event.status !== EventStatus.LIVE
  ) {
    return (
      <ClosedState
        title="活动未开放报名"
        description="请等待主办方发布活动后再试。"
      />
    );
  }

  return <RegisterClient eventId={event.id} eventName={event.name} />;
}

function ClosedState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
    </div>
  );
}
