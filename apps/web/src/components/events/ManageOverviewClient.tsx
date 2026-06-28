"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ClipboardList,
  Gift,
  Handshake,
  Monitor,
  ScanLine,
  Settings,
  Store,
  Trophy,
  UserCheck,
  Users,
} from "lucide-react";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
  SectionCard,
} from "@/components/admin/admin-header";
import { Button } from "@/components/ui/button";
import { backgroundPoll } from "@/lib/query-options";
import { cn } from "@/lib/utils";

type ManageOverviewConference = {
  kind: "CONFERENCE";
  event_id: string;
  event_name: string;
  status: string;
  total_registered: number;
  checked_in: number;
  checkin_rate: number;
  connections: number;
  interaction_participations: number;
  peak_insight?: string;
};

type ManageOverviewExpo = {
  kind: "EXPO";
  event_id: string;
  event_name: string;
  status: string;
  total_registered: number;
  checked_in: number;
  checkin_rate: number;
  booth_heat_total: number;
  booth_rankings: Array<{
    booth_id: string;
    booth_name: string;
    booth_code: string;
    heat: number;
    tag?: "hottest" | "coldest";
  }>;
  pending_exhibitors: Array<{
    id: string;
    company_name: string;
    booth_code: string;
    status: string;
  }>;
};

type ManageOverviewBooth = {
  kind: "BOOTH";
  event_id: string;
  event_name: string;
  booth_id?: string;
  booth_code: string;
  status: string;
  visitors_today: number;
  leads_captured: number;
  interaction_participants: number;
  ai_buyers_count: number;
};

type ManageOverview =
  | ManageOverviewConference
  | ManageOverviewExpo
  | ManageOverviewBooth;

async function fetchManageOverview(eventId: string): Promise<ManageOverview> {
  const res = await fetch(`/api/account/events/${eventId}/manage-overview`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as ManageOverview;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  LIVE: "进行中",
  ENDED: "已结束",
};

function StatCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-4 shadow-sm">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-text">
        {value}
        {suffix ? (
          <span className="ml-0.5 text-base font-normal text-text-muted">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function ActionTile({
  href,
  icon: Icon,
  title,
  desc,
  external,
}: {
  href: string;
  icon: typeof ScanLine;
  title: string;
  desc: string;
  external?: boolean;
}) {
  const className =
    "flex items-start gap-3 rounded-xl border border-border-light bg-white p-4 shadow-sm transition-colors hover:border-brand-blue/30 hover:bg-brand-blue/5";

  const inner = (
    <>
      <Icon className="mt-0.5 size-5 shrink-0 text-brand-blue" />
      <div className="min-w-0">
        <p className="font-medium text-text">{title}</p>
        <p className="mt-0.5 text-xs text-text-muted">{desc}</p>
      </div>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function ConferencePanel({
  data,
  eventId,
}: {
  data: ManageOverviewConference;
  eventId: string;
}) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="报名人数" value={data.total_registered} />
        <StatCard label="已签到" value={data.checked_in} />
        <StatCard
          label="签到率"
          value={data.checkin_rate}
          suffix="%"
        />
        <StatCard label="连接数" value={data.connections} />
      </div>

      {data.peak_insight && (
        <SectionCard title="运营洞察">
          <p className="text-sm text-text-muted">{data.peak_insight}</p>
        </SectionCard>
      )}

      <SectionCard title="快捷操作">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionTile
            href={`/events/${eventId}/scan`}
            icon={ScanLine}
            title="扫码核验"
            desc="胸牌签到与线索采集 AD5"
          />
          <ActionTile
            href={`/events/${eventId}/checkin`}
            icon={Users}
            title="签到看板"
            desc="实时签到统计与 VIP 追踪"
          />
          <ActionTile
            href={`/events/${eventId}/live-ops`}
            icon={Monitor}
            title="现场指挥中心"
            desc="签到流、互动战情室与广播"
          />
          <ActionTile
            href={`/events/${eventId}/participants`}
            icon={ClipboardList}
            title="参会者名单"
            desc="导入、筛选与手动签到"
          />
          <ActionTile
            href={`/events/${eventId}/connections`}
            icon={Handshake}
            title="连接数据"
            desc="商务连接与配对分析"
          />
          <ActionTile
            href={`/events/${eventId}/interactions`}
            icon={BarChart3}
            title="互动管理"
            desc="Poll、Q&A 与互动大屏"
          />
        </div>
      </SectionCard>
    </>
  );
}

function ExpoPanel({ data, eventId }: { data: ManageOverviewExpo; eventId: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="报名人数" value={data.total_registered} />
        <StatCard label="已签到" value={data.checked_in} />
        <StatCard label="签到率" value={data.checkin_rate} suffix="%" />
        <StatCard label="展位总热度" value={data.booth_heat_total} />
      </div>

      {data.pending_exhibitors.length > 0 && (
        <SectionCard
          title={`待审展商（${data.pending_exhibitors.length}）`}
          description="需尽快审核以开放展位运营"
        >
          <ul className="divide-y divide-border">
            {data.pending_exhibitors.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 py-2 text-sm"
              >
                <span>
                  {row.booth_code} · {row.company_name}
                </span>
                <span className="text-xs text-amber-600">待审核</span>
              </li>
            ))}
          </ul>
          <Link href={`/events/${eventId}/exhibitor-reviews`} className="mt-3 inline-block">
            <Button variant="outline" size="sm">
              前往展商审核
            </Button>
          </Link>
        </SectionCard>
      )}

      {data.booth_rankings.length > 0 && (
        <SectionCard title="展位热度 Top">
          <ul className="space-y-2">
            {data.booth_rankings.slice(0, 5).map((booth) => (
              <li
                key={booth.booth_id}
                className="flex items-center justify-between gap-2 text-sm"
              >
                <span className={cn(booth.tag === "hottest" && "font-medium text-brand-blue")}>
                  {booth.booth_code} {booth.booth_name}
                </span>
                <span className="tabular-nums text-text-muted">{booth.heat}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="快捷操作">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ActionTile
            href={`/events/${eventId}/exhibitor-reviews`}
            icon={UserCheck}
            title="展商审核"
            desc="审核入驻申请与展位分配"
          />
          <ActionTile
            href={`/events/${eventId}/stamp-monitor`}
            icon={Trophy}
            title="集章监控"
            desc="各展位打卡与完成率"
          />
          <ActionTile
            href={`/events/${eventId}/lottery`}
            icon={Gift}
            title="现场抽奖"
            desc="开奖与中奖管理"
          />
          <ActionTile
            href={`/events/${eventId}/scan`}
            icon={ScanLine}
            title="扫码核验"
            desc="入口签到与线索采集"
          />
          <ActionTile
            href={`/events/${eventId}/admin-leads`}
            icon={ClipboardList}
            title="全场线索"
            desc="跨展位线索汇总与导出"
          />
          <ActionTile
            href={`/events/${eventId}/expo-settings`}
            icon={Settings}
            title="展会配置"
            desc="报名、买家与匹配规则"
          />
          <ActionTile
            href={`/events/${eventId}/exhibitors/booths`}
            icon={Store}
            title="展商列表"
            desc="展位与展商信息"
          />
          <ActionTile
            href={`/events/${eventId}/live-ops`}
            icon={Monitor}
            title="现场指挥中心"
            desc="实时运营与全场广播"
          />
        </div>
      </SectionCard>
    </>
  );
}

function BoothPanel({ data, eventId }: { data: ManageOverviewBooth; eventId: string }) {
  const boothId = data.booth_id;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="今日访客" value={data.visitors_today} />
        <StatCard label="累计线索" value={data.leads_captured} />
        <StatCard label="互动参与" value={data.interaction_participants} />
        <StatCard label="AI 推荐买家" value={data.ai_buyers_count} />
      </div>

      <SectionCard title="快捷操作">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {boothId ? (
            <>
              <ActionTile
                href={`/exhibitor/booths/${boothId}`}
                icon={Store}
                title="展位工作台"
                desc="今日数据与互动控制"
              />
              <ActionTile
                href={`/exhibitor/booths/${boothId}/leads`}
                icon={ClipboardList}
                title="线索管理"
                desc="采集记录与导出"
              />
            </>
          ) : null}
          <ActionTile
            href={`/events/${eventId}/scan?mode=lead_capture`}
            icon={ScanLine}
            title="扫码采集线索"
            desc="扫描访客名片入库"
          />
        </div>
      </SectionCard>
    </>
  );
}

export function ManageOverviewClient({
  eventId,
  eventName,
}: {
  eventId: string;
  eventName: string;
}) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["manage-overview", eventId],
    queryFn: () => fetchManageOverview(eventId),
    ...backgroundPoll(30_000),
  });

  const kindLabel =
    data?.kind === "EXPO"
      ? "展会管理"
      : data?.kind === "BOOTH"
        ? "参展运营"
        : "会议管理";

  return (
    <AdminPage>
      <AdminHeader
        title={kindLabel}
        description={`${eventName} · 一屏总览与快捷入口`}
        breadcrumb={["活动", kindLabel]}
        actions={
          <div className="flex gap-2">
            <Link href={`/events/${eventId}/settings`}>
              <Button variant="outline" size="sm">
                活动设置
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              刷新
            </Button>
          </div>
        }
      />
      <AdminContent>
        {isLoading && (
          <p className="text-sm text-text-muted">加载管理面板…</p>
        )}
        {isError && (
          <p className="text-sm text-destructive">加载失败，请稍后重试</p>
        )}
        {data && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-blue/10 px-3 py-1 text-xs font-medium text-brand-blue">
                {STATUS_LABEL[data.status] ?? data.status}
              </span>
              <span className="text-sm text-text-muted">{data.event_name}</span>
            </div>

            {data.kind === "CONFERENCE" && (
              <ConferencePanel data={data} eventId={eventId} />
            )}
            {data.kind === "EXPO" && (
              <ExpoPanel data={data} eventId={eventId} />
            )}
            {data.kind === "BOOTH" && (
              <BoothPanel data={data} eventId={eventId} />
            )}
          </div>
        )}
      </AdminContent>
    </AdminPage>
  );
}
