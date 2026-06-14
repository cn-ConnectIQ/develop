"use client";

import { BoothStatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";

export type BoothTableRow = {
  id: string;
  code: string;
  name: string;
  status: string;
  exhibitor: { name: string };
  stats: {
    todayVisitors: number;
    gradeA: number;
    crmSynced: number;
  };
};

type BoothMapTableViewProps = {
  booths: BoothTableRow[];
  onBack: () => void;
};

export function BoothMapTableView({ booths, onBack }: BoothMapTableViewProps) {
  return (
    <div className="admin-content">
      <div className="admin-content-inner space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">展位表格视图</h1>
          <Button variant="outline" onClick={onBack}>
            返回地图
          </Button>
        </div>
        <div className="admin-card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[#fafaf8] text-left text-xs text-text-muted">
                <th className="p-3">展位号</th>
                <th className="p-3">展商名</th>
                <th className="p-3">状态</th>
                <th className="p-3">今日访客</th>
                <th className="p-3">A级线索</th>
                <th className="p-3">CRM同步</th>
              </tr>
            </thead>
            <tbody>
              {booths.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-text-muted">
                    暂无展位数据
                  </td>
                </tr>
              )}
              {booths.map((booth) => (
                <tr key={booth.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono text-brand-blue">{booth.code}</td>
                  <td className="p-3">{booth.exhibitor.name}</td>
                  <td className="p-3">
                    <BoothStatusBadge status={booth.status} />
                  </td>
                  <td className="p-3 tabular-nums">{booth.stats.todayVisitors}</td>
                  <td className="p-3 tabular-nums text-brand-green">
                    {booth.stats.gradeA}
                  </td>
                  <td className="p-3 tabular-nums">{booth.stats.crmSynced}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
