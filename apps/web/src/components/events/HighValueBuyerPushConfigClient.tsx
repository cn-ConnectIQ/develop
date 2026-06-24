"use client";

import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";

export function HighValueBuyerPushConfigClient({ eventId }: { eventId: string }) {
  return (
    <AdminPage>
      <AdminHeader
        title="高价值买家推送"
        description="当买家在展位产生高意向行为时，实时通知对应展商"
        breadcrumb={["活动", "高价值买家推送"]}
      />
      <AdminContent>
        <SectionCard title="推送规则（默认）">
          <ul className="list-inside list-disc space-y-2 text-sm text-text-muted">
            <li>
              <span className="font-medium text-text">A 级</span>
              ：买家在该展位完成线索采集（留资表单）
            </li>
            <li>
              <span className="font-medium text-text">B 级</span>
              ：买家扫描同一展位 ≥ 2 次
            </li>
            <li>同一买家对同一展位推送冷却 1 小时，避免重复打扰</li>
            <li>推送渠道：展商账号通知 + Feed 提醒</li>
          </ul>
          <p className="mt-4 text-xs text-text-muted">
            活动 ID：{eventId} · 关闭「功能模块」中的本开关后，推送将停止且管理入口隐藏
          </p>
        </SectionCard>
      </AdminContent>
    </AdminPage>
  );
}
