import type { Metadata } from "next";
import { JoinClient } from "./JoinClient";
import { resolveJoinPageData } from "@/lib/invite/service";

type PageProps = {
  searchParams: Promise<{ token?: string; event?: string }>;
};

export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const data = await resolveJoinPageData(params.token, params.event, {
    recordClick: false,
  });

  if (data.kind === "invalid") {
    return {
      title: "邀请链接无效 · ConnectIQ",
      description: "此邀请链接已失效，请联系活动主办方重新发送邀请。",
      robots: { index: false, follow: false },
    };
  }

  const eventName = data.event.name;
  const description =
    data.kind === "activated"
      ? `你已成功加入 ${eventName}，打开 ConnectIQ 开始现场社交。`
      : `${data.organizerName} 邀请你参加 ${eventName}，下载 ConnectIQ 开启 AI 商务配对与现场社交。`;

  return {
    title: `${eventName} · ConnectIQ 活动邀请`,
    description,
    openGraph: {
      title: `${eventName} · ConnectIQ`,
      description,
      type: "website",
      ...(data.event.coverUrl ? { images: [{ url: data.event.coverUrl }] } : {}),
    },
    robots: { index: false, follow: false },
  };
}

export default async function JoinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const data = await resolveJoinPageData(params.token, params.event, {
    recordClick: true,
  });

  return <JoinClient data={data} />;
}
