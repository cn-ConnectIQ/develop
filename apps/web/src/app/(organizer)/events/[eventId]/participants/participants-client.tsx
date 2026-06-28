"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Columns3,
  Filter,
  Search,
  Upload,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import {
  CreateCampaignSheet,
  useEventDateLabel,
} from "@/components/invites/CreateCampaignSheet";
import { AddParticipantSheet } from "@/components/participants/AddParticipantSheet";
import { ParticipantTable } from "@/components/participants/ParticipantTable";
import { useCurrentEvent } from "@/contexts/event-context";
import type { ParticipantListItem } from "@/lib/participants";
import { useEventFeatureFlags } from "@/hooks/useEventFeatureFlags";
import { isFeatureFlagEnabled } from "@/lib/event-feature-flags";
import { cn } from "@/lib/utils";

type StatusFilter =
  | "all"
  | "checked_in"
  | "pending"
  | "vip"
  | "speaker"
  | "not_invited";

const STATUS_TABS: Array<{ id: StatusFilter; label: string; countKey?: string }> =
  [
    { id: "all", label: "全部" },
    { id: "checked_in", label: "已签到" },
    { id: "pending", label: "未签到" },
    { id: "vip", label: "VIP" },
    { id: "speaker", label: "演讲者" },
    { id: "not_invited", label: "未邀请", countKey: "notInvited" },
  ];

type ParticipantsMeta = {
  total: number;
  checkedIn: number;
  pending: number;
  vip: number;
  activated: number;
  invited: number;
  notInvited: number;
  activationRate: number;
  ticketTypes: Array<{ id: string; name: string }>;
};

async function fetchParticipants(
  eventId: string,
  search: string,
  status: StatusFilter,
) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status === "checked_in" || status === "pending") {
    params.set("status", status);
  }
  if (status === "vip" || status === "speaker") {
    params.set("role", status);
  }
  if (status === "not_invited") {
    params.set("invite_status", "not_invited");
  }
  params.set("limit", "100");

  const res = await fetch(
    `/api/events/${eventId}/participants?${params.toString()}`,
  );
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return {
    items: json.data as ParticipantListItem[],
    meta: json.meta as ParticipantsMeta,
  };
}

export function ParticipantsPageClient({ eventId }: { eventId: string }) {
  const { currentEvent } = useCurrentEvent();
  const { data: featureFlags } = useEventFeatureFlags(eventId);
  const showInviteSystem = isFeatureFlagEnabled(featureFlags, "inviteSystem");
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get("status") as StatusFilter) ?? "all";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkInviteIds, setBulkInviteIds] = useState<string[] | undefined>();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  useEffect(() => {
    const fromUrl = searchParams.get("status") as StatusFilter | null;
    if (fromUrl) setStatus(fromUrl);
  }, [searchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["participants", eventId, debouncedSearch, status],
    queryFn: () => fetchParticipants(eventId, debouncedSearch, status),
  });

  const handleCheckIn = useCallback(
    async (participantId: string) => {
      const res = await fetch(
        `/api/events/${eventId}/participants/${participantId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkIn: true }),
        },
      );
      if (!res.ok) {
        toast.error("签到失败");
        return;
      }
      toast.success("签到成功");
      void refetch();
    },
    [eventId, refetch],
  );

  const handleRemove = useCallback(
    async (participantId: string) => {
      const res = await fetch(
        `/api/events/${eventId}/participants/${participantId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        toast.error("移除失败");
        return;
      }
      toast.success("已移除");
      void refetch();
    },
    [eventId, refetch],
  );

  const meta = data?.meta;
  const stats = {
    total: meta?.total ?? 0,
    checkedIn: meta?.checkedIn ?? 0,
    pending: meta?.pending ?? 0,
    vip: meta?.vip ?? 0,
    activated: meta?.activated ?? 0,
    invited: meta?.invited ?? 0,
    notInvited: meta?.notInvited ?? 0,
    activationRate: meta?.activationRate ?? 0,
  };

  const statusTabs = useMemo(
    () =>
      showInviteSystem
        ? STATUS_TABS
        : STATUS_TABS.filter((tab) => tab.id !== "not_invited"),
    [showInviteSystem],
  );

  useEffect(() => {
    if (!showInviteSystem && status === "not_invited") {
      setStatus("all");
    }
  }, [showInviteSystem, status]);

  const eventName = currentEvent?.name ?? "活动";
  const eventDate = useEventDateLabel(currentEvent?.startDate);

  function openInviteSheet(participantIds?: string[]) {
    setBulkInviteIds(participantIds);
    setInviteOpen(true);
  }

  function handleInviteOpenChange(open: boolean) {
    setInviteOpen(open);
    if (!open) setBulkInviteIds(undefined);
  }

  return (
    <AdminPageBody>
      <div className="mb-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--admin-ink)]">名单管理</h1>
          {showInviteSystem && (
            <Link
              href={`/events/${eventId}/invite-campaigns`}
              className="mt-1 inline-block text-xs text-brand-blue hover:underline"
            >
              查看邀请记录 →
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/events/${eventId}/data-import`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            <Upload className="mr-1 size-4" />
            数据导入
          </Link>
          <Button
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-1 size-4" />
            手动添加
          </Button>
          {showInviteSystem && (
            <Button
              className="bg-brand-purple text-white hover:bg-brand-purple/90"
              onClick={() => openInviteSheet()}
            >
              <Bot className="mr-1 size-4" />
              邀请加入 ConnectIQ
            </Button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2",
          showInviteSystem ? "lg:grid-cols-5" : "lg:grid-cols-4",
        )}
      >
        <StatTile label="总报名" value={stats.total} valueClass="text-brand-blue" />
        <StatTile
          label="已签到"
          value={stats.checkedIn}
          valueClass="text-brand-green"
        />
        <StatTile
          label="未签到"
          value={stats.pending}
          valueClass="text-text-muted"
        />
        <StatTile label="VIP" value={stats.vip} valueClass="text-brand-gold" />
        {showInviteSystem && (
          <ActivationStatTile
            activated={stats.activated}
            invited={stats.invited}
            activationRate={stats.activationRate}
          />
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-tertiary" />
          <Input
            className="pl-9"
            placeholder="姓名/公司/手机号"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {statusTabs.map((tab) => {
            const count =
              tab.countKey === "notInvited" ? stats.notInvited : undefined;
            return (
              <button
                key={tab.id}
                type="button"
                className={cn(
                  "inline-flex h-[30px] items-center rounded-lg border px-3 text-[12.5px] transition-colors",
                  status === tab.id
                    ? "border-brand-blue bg-brand-blue text-white"
                    : "border-border-light bg-white text-text-muted hover:border-[#c5c2b8]",
                )}
                onClick={() => setStatus(tab.id)}
              >
                {tab.label}
                {count !== undefined ? `（${count}）` : ""}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => setShowAdvanced((v) => !v)}
          >
            <Filter className="mr-1 size-3.5" />
            筛选 ▾
          </Button>
          {showAdvanced && (
            <select
              className="h-8 rounded-md border border-border-light px-2 text-sm"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              <option value="all">全部角色</option>
              <option value="ATTENDEE">参会者</option>
              <option value="SPEAKER">演讲者</option>
              <option value="EXHIBITOR">展商</option>
            </select>
          )}
          <Button
            variant="outline"
            size="icon-sm"
            className="size-8"
            onClick={() =>
              toast.success("当前显示：姓名、公司、票种、签到、邀请状态")
            }
            aria-label="列设置"
          >
            <Columns3 className="size-4" />
          </Button>
        </div>
      </div>

      <ParticipantTable
        eventId={eventId}
        data={(data?.items ?? []).filter(
          (p) => roleFilter === "all" || p.role === roleFilter,
        )}
        isLoading={isLoading}
        statusFilter={status}
        ticketTypes={data?.meta?.ticketTypes ?? []}
        onCheckIn={handleCheckIn}
        onRemove={handleRemove}
        onRefresh={() => void refetch()}
        onBulkInvite={showInviteSystem ? (ids) => openInviteSheet(ids) : undefined}
      />

      <AddParticipantSheet
        eventId={eventId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={() => void refetch()}
      />

      {showInviteSystem && (
        <CreateCampaignSheet
          eventId={eventId}
          open={inviteOpen}
          onOpenChange={handleInviteOpenChange}
          eventName={eventName}
          eventDate={eventDate}
          organizerName="主办方"
          stats={{
            total: stats.total,
            notInvited: stats.notInvited,
            activated: stats.activated,
          }}
          ticketTypes={meta?.ticketTypes ?? []}
          initialParticipantIds={bulkInviteIds}
          onSuccess={() => void refetch()}
        />
      )}
    </AdminPageBody>
  );
}

function StatTile({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-5">
      <p className="text-[12.5px] text-text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-[34px] font-semibold leading-none tabular-nums",
          valueClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function ActivationStatTile({
  activated,
  invited,
  activationRate,
}: {
  activated: number;
  invited: number;
  activationRate: number;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-5">
      <p className="text-[12.5px] text-text-muted">已激活</p>
      <p className="mt-2 text-[34px] font-semibold leading-none tabular-nums text-brand-purple">
        {activated}
      </p>
      <p className="mt-1 text-xs text-text-muted">/ 已邀请 {invited}</p>
      <Progress
        value={activationRate}
        className="mt-3"
        indicatorClassName="bg-brand-purple"
      />
      <p className="mt-1 text-right text-xs text-text-muted">
        {activationRate}%
      </p>
    </div>
  );
}
