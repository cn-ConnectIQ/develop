"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  Columns3,
  Filter,
  RefreshCw,
  Search,
  Upload,
  UserPlus,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import {
  CreateCampaignSheet,
  useEventDateLabel,
} from "@/components/invites/CreateCampaignSheet";
import { AddParticipantSheet } from "@/components/participants/AddParticipantSheet";
import { ImportSheet } from "@/components/participants/ImportSheet";
import { ParticipantTable } from "@/components/participants/ParticipantTable";
import { useCurrentEvent } from "@/contexts/event-context";
import type { ParticipantListItem } from "@/lib/participants";
import { LockedOverlay } from "@/components/events/EventReviewBanner";
import { useIsEventReviewLocked } from "@/hooks/useEventReviewLock";
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
  const isReviewLocked = useIsEventReviewLocked(eventId);
  const searchParams = useSearchParams();
  const initialStatus = (searchParams.get("status") as StatusFilter) ?? "all";

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>(initialStatus);
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [bulkInviteIds, setBulkInviteIds] = useState<string[] | undefined>();
  const [lastSync] = useState<string | null>(null);

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
          <Link
            href={`/events/${eventId}/invite-campaigns`}
            className="mt-1 inline-block text-xs text-brand-blue hover:underline"
          >
            查看邀请记录 →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-col items-end gap-0.5">
            <Button
              variant="outline"
              onClick={() => toast.info("百格数据同步将在后续版本开放")}
            >
              <RefreshCw className="mr-1 size-4" />
              同步百格数据
            </Button>
            {lastSync ? (
              <span className="text-[10px] text-text-muted">
                最后同步 {format(new Date(lastSync), "M/d HH:mm")}
              </span>
            ) : (
              <span className="text-[10px] text-text-muted">尚未同步</span>
            )}
          </div>
          <LockedOverlay locked={isReviewLocked} tooltip="审核通过后可用">
            <Button
              variant="outline"
              disabled={isReviewLocked}
              onClick={() => !isReviewLocked && setImportOpen(true)}
            >
              <Upload className="mr-1 size-4" />
              导入 Excel
            </Button>
          </LockedOverlay>
          <Button
            className="bg-brand-blue text-white hover:bg-brand-blue/90"
            onClick={() => setAddOpen(true)}
          >
            <UserPlus className="mr-1 size-4" />
            手动添加
          </Button>
          <Button
            className="bg-brand-purple text-white hover:bg-brand-purple/90"
            onClick={() => openInviteSheet()}
          >
            <Bot className="mr-1 size-4" />
            邀请加入 ConnectIQ
          </Button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
        <ActivationStatTile
          activated={stats.activated}
          invited={stats.invited}
          activationRate={stats.activationRate}
        />
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
          {STATUS_TABS.map((tab) => {
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
            onClick={() => toast.info("高级筛选将在后续版本开放")}
          >
            <Filter className="mr-1 size-3.5" />
            筛选 ▾
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            className="size-8"
            onClick={() => toast.info("列设置将在后续版本开放")}
            aria-label="列设置"
          >
            <Columns3 className="size-4" />
          </Button>
        </div>
      </div>

      <ParticipantTable
        data={data?.items ?? []}
        isLoading={isLoading}
        statusFilter={status}
        onCheckIn={handleCheckIn}
        onRemove={handleRemove}
        onRefresh={() => void refetch()}
        onBulkInvite={(ids) => openInviteSheet(ids)}
      />

      <ImportSheet
        eventId={eventId}
        open={importOpen}
        onOpenChange={setImportOpen}
        onSuccess={() => void refetch()}
      />

      <AddParticipantSheet
        eventId={eventId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={() => void refetch()}
      />

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
