import type { Metadata } from "next";
import { AlertCircle } from "lucide-react";
import { InteractionClient } from "@/app/i/[sessionCode]/InteractionClient";
import { getInteractionSessionPageData } from "@/lib/interaction/session-service";

type PageProps = {
  params: Promise<{ sessionCode: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { sessionCode } = await params;
  const data = await getInteractionSessionPageData(sessionCode);

  if (!data) {
    return { title: "互动已结束" };
  }

  return {
    title: `${data.event.name} · ${data.session.name}`,
    description: `参与 ${data.event.name} 现场互动`,
    openGraph: {
      title: `${data.event.name} · ${data.session.name}`,
      description: data.booth
        ? `${data.booth.name} 展位互动`
        : "扫码参与现场互动",
    },
  };
}

export default async function InteractionLandingPage({ params }: PageProps) {
  const { sessionCode } = await params;
  const data = await getInteractionSessionPageData(sessionCode);

  if (!data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-[390px] flex-col items-center justify-center bg-content-bg px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-border-light">
          <AlertCircle className="size-8 text-text-muted" />
        </div>
        <h1 className="mt-5 text-lg font-semibold">互动已结束</h1>
        <p className="mt-2 text-sm text-text-muted">
          该二维码已失效或互动已关闭，请联系现场工作人员。
        </p>
        <p className="mt-6 font-mono text-xs text-text-tertiary">
          /i/{sessionCode.toUpperCase()}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-dvh max-w-[390px] bg-content-bg">
      <InteractionClient sessionCode={sessionCode} initialData={data} />
    </div>
  );
}
