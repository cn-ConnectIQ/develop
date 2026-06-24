"use client";

import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { AiReferralScanCard } from "@/components/events/AiReferralScanCard";

export function AiReferralConfigClient({ eventId }: { eventId: string }) {
  return (
    <AdminPage>
      <AdminHeader
        title="AI 引荐配置"
        description="扫描参会者连接网络，自动发现可引荐的间接商业配对"
        breadcrumb={["活动", "AI 引荐"]}
      />
      <AdminContent className="space-y-6">
        <AiReferralScanCard eventId={eventId} />
        <SectionCard title="触发规则">
          <ul className="list-inside list-disc space-y-1 text-sm text-text-muted">
            <li>签到达 50 人时自动触发首次扫描</li>
            <li>活动开始 2 小时后由定时任务再次扫描</li>
            <li>也可在上方手动立即扫描</li>
          </ul>
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
