"use client";

import Link from "next/link";
import { Handshake, Monitor } from "lucide-react";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";

export function SpeedNetworkingConfigClient({ eventId }: { eventId: string }) {
  return (
    <AdminPage>
      <AdminHeader
        title="Speed Networking 配置"
        description="结构化快速配对，帮助参会者在限定轮次内高效认识更多人"
        breadcrumb={["活动", "Speed Networking"]}
      />
      <AdminContent className="space-y-6">
        <SectionCard title="场次说明">
          <p className="text-sm text-text-muted">
            开启后，参会者可在小程序参与 Speed Networking 轮次，连接来源将标记为
            SN。现场可通过互动大屏查看连接热力。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/events/${eventId}/interactions/bigscreen?tab=network_heat`}
              target="_blank"
              className="inline-flex h-9 items-center rounded-lg bg-brand-blue px-4 text-sm text-white hover:bg-brand-blue/90"
            >
              <Monitor className="mr-1 size-4" />
              打开连接热力大屏
            </Link>
            <Link
              href={`/events/${eventId}/reports#matching`}
              className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-sm hover:bg-content"
            >
              <Handshake className="mr-1 size-4" />
              查看配对报告
            </Link>
          </div>
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
