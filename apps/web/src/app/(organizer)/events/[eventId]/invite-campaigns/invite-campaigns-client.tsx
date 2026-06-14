"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus } from "lucide-react";
import { InviteRecordStatus } from "@/lib/invite/enums";
import { toast } from "sonner";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CampaignCard } from "@/components/invites/CampaignCard";
import {
  CreateCampaignSheet,
  useEventDateLabel,
} from "@/components/invites/CreateCampaignSheet";
import { InviteFunnel } from "@/components/invites/InviteFunnel";
import {
  aggregateFunnelStats,
  useInviteCampaigns,
  useInviteRecords,
  useRetryInviteCampaign,
} from "@/hooks/useInviteCampaigns";
import { useCurrentEvent } from "@/contexts/event-context";
import { cn } from "@/lib/utils";

const RECORD_TABS = [
  { id: "all", label: "全部" },
  { id: InviteRecordStatus.ACTIVATED, label: "已激活" },
  { id: InviteRecordStatus.CLICKED, label: "已点击" },
  { id: InviteRecordStatus.SENT, label: "已发送" },
  { id: InviteRecordStatus.FAILED, label: "失败" },
] as const;

const CHANNEL_BADGE: Record<string, string> = {
  SMS: "bg-brand-blue-light text-brand-blue",
  EMAIL: "bg-brand-green-light text-brand-green",
  WECHAT: "bg-brand-green-light text-brand-green",
};

const RECORD_STATUS: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: { label: "待发送", className: "bg-gray-100 text-text-muted" },
  SENT: { label: "已发送", className: "bg-brand-blue-light text-brand-blue" },
  DELIVERED: { label: "已送达", className: "bg-brand-blue-light text-brand-blue" },
  CLICKED: { label: "已点击", className: "bg-brand-green-light text-brand-green" },
  ACTIVATED: { label: "已激活", className: "bg-brand-green text-white" },
  FAILED: { label: "失败", className: "bg-brand-red-light text-brand-red" },
  SKIPPED: { label: "已跳过", className: "bg-gray-100 text-text-muted" },
};

function maskDestination(value: string) {
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (value.length >= 7) {
    return `${value.slice(0, 3)}****${value.slice(-4)}`;
  }
  return value;
}

export function InviteCampaignsPageClient({ eventId }: { eventId: string }) {
  const { currentEvent } = useCurrentEvent();
  const [pageTab, setPageTab] = useState<"campaigns" | "records">("campaigns");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(
    null,
  );
  const [recordFilter, setRecordFilter] = useState("all");

  const { data: campaigns, isLoading, refetch } = useInviteCampaigns(eventId);
  const retryMutation = useRetryInviteCampaign(eventId);

  const { data: participantMeta } = useQuery({
    queryKey: ["participants-meta", eventId],
    queryFn: async () => {
      const res = await fetch(
        `/api/events/${eventId}/participants?limit=1`,
      );
      if (!res.ok) throw new Error("加载失败");
      const json = await res.json();
      return json.meta as {
        total: number;
        notInvited: number;
        activated: number;
        ticketTypes: Array<{ id: string; name: string }>;
      };
    },
  });

  const { data: recordsData, isLoading: recordsLoading } = useInviteRecords(
    eventId,
    selectedCampaignId,
    recordFilter,
  );

  useEffect(() => {
    if (campaigns?.length && !selectedCampaignId) {
      setSelectedCampaignId(campaigns[0].id);
    }
  }, [campaigns, selectedCampaignId]);

  const funnel = aggregateFunnelStats(campaigns ?? []);

  const eventName = currentEvent?.name ?? "活动";
  const eventDate = useEventDateLabel(currentEvent?.startDate);

  async function handleRetry(campaignId: string) {
    try {
      const result = await retryMutation.mutateAsync(campaignId);
      toast.success(`已重试 ${result.retried} 条失败记录`);
      void refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重试失败");
    }
  }

  return (
    <AdminPageBody>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--admin-ink)]">邀请管理</h1>
          <Link
            href={`/events/${eventId}/participants`}
            className="mt-1 inline-block text-xs text-brand-blue hover:underline"
          >
            ← 返回名单管理
          </Link>
        </div>
        <Button
          className="bg-brand-purple text-white hover:bg-brand-purple/90"
          onClick={() => setSheetOpen(true)}
        >
          <Plus className="mr-1 size-4" />
          创建邀请活动
        </Button>
      </div>

      <Tabs
        value={pageTab}
        onValueChange={(v) => setPageTab(v as "campaigns" | "records")}
      >
        <TabsList className="mb-6">
          <TabsTrigger value="campaigns">邀请活动</TabsTrigger>
          <TabsTrigger value="records">发送记录</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6">
          <InviteFunnel
            sent={funnel.sent}
            delivered={funnel.delivered}
            clicked={funnel.clicked}
            activated={funnel.activated}
          />

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full rounded-xl" />
              ))}
            </div>
          ) : campaigns?.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border-light bg-white p-12 text-center">
              <p className="text-sm text-text-muted">暂无邀请活动</p>
              <Button
                className="mt-4 bg-brand-purple text-white hover:bg-brand-purple/90"
                onClick={() => setSheetOpen(true)}
              >
                创建第一个邀请活动
              </Button>
            </div>
          ) : (
            campaigns?.map((c) => (
              <CampaignCard
                key={c.id}
                eventId={eventId}
                campaign={c}
                onRetry={(id) => void handleRetry(id)}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-text-muted">邀请活动</span>
            <Select
              value={selectedCampaignId ?? ""}
              onValueChange={(v) => setSelectedCampaignId(v || null)}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="选择邀请活动" />
              </SelectTrigger>
              <SelectContent>
                {campaigns?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedCampaignId ? (
            <p className="text-sm text-text-muted">请先选择邀请活动</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {RECORD_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      "inline-flex h-[30px] items-center rounded-lg border px-3 text-[12.5px] transition-colors",
                      recordFilter === tab.id
                        ? "border-brand-blue bg-brand-blue text-white"
                        : "border-border-light bg-white text-text-muted hover:border-[#c5c2b8]",
                    )}
                    onClick={() => setRecordFilter(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto rounded-xl border border-border-light bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="h-10 bg-content text-xs font-semibold text-text-muted">
                        参会者
                      </TableHead>
                      <TableHead className="h-10 bg-content text-xs font-semibold text-text-muted">
                        渠道
                      </TableHead>
                      <TableHead className="h-10 bg-content text-xs font-semibold text-text-muted">
                        发送到
                      </TableHead>
                      <TableHead className="h-10 bg-content text-xs font-semibold text-text-muted">
                        发送时间
                      </TableHead>
                      <TableHead className="h-10 bg-content text-xs font-semibold text-text-muted">
                        状态
                      </TableHead>
                      <TableHead className="h-10 bg-content text-xs font-semibold text-text-muted" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recordsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}>
                            <Skeleton className="h-12 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    ) : recordsData?.records.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-sm text-text-muted"
                        >
                          暂无发送记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      recordsData?.records.map((record) => {
                        const statusMeta =
                          RECORD_STATUS[record.status] ?? RECORD_STATUS.PENDING;
                        const isFailed = record.status === InviteRecordStatus.FAILED;
                        return (
                          <TableRow
                            key={record.id}
                            className={cn(
                              "h-12",
                              isFailed && "bg-brand-red-light/50",
                            )}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="size-7">
                                  <AvatarFallback className="bg-brand-blue-light text-xs text-brand-blue">
                                    {record.participant.name.slice(0, 1)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">
                                    {record.participant.name}
                                  </p>
                                  <p className="text-xs text-text-muted">
                                    {record.participant.company ?? "—"}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={CHANNEL_BADGE[record.channel]}>
                                {record.channel}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-text-muted">
                              {maskDestination(record.destination)}
                            </TableCell>
                            <TableCell className="text-sm text-text-muted">
                              {record.sentAt
                                ? format(new Date(record.sentAt), "M/d HH:mm")
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusMeta.className}>
                                {statusMeta.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isFailed && selectedCampaignId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs text-brand-blue"
                                  onClick={() =>
                                    void handleRetry(selectedCampaignId)
                                  }
                                >
                                  重试
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <CreateCampaignSheet
        eventId={eventId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        eventName={eventName}
        eventDate={eventDate}
        organizerName="主办方"
        stats={{
          total: participantMeta?.total ?? 0,
          notInvited: participantMeta?.notInvited ?? 0,
          activated: participantMeta?.activated ?? 0,
        }}
        ticketTypes={participantMeta?.ticketTypes ?? []}
        onSuccess={() => void refetch()}
      />
    </AdminPageBody>
  );
}
