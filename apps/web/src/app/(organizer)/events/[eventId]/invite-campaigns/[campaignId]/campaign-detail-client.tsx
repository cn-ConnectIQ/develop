"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format, differenceInMinutes } from "date-fns";
import {
  ArrowRight,
  Check,
  Loader2,
  RotateCcw,
} from "lucide-react";
import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
} from "@/lib/invite/enums";
import { toast } from "sonner";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CreateCampaignSheet,
  useEventDateLabel,
} from "@/components/invites/CreateCampaignSheet";
import {
  useInviteCampaignProgress,
  useInviteRecords,
  useRetryInviteCampaign,
  type InviteCampaignProgress,
} from "@/hooks/useInviteCampaigns";
import { useCurrentEvent } from "@/contexts/event-context";
import { cn } from "@/lib/utils";

const CHANNEL_LABEL: Record<InviteChannel, string> = {
  SMS: "短信",
  EMAIL: "邮件",
  WECHAT: "微信",
};

const CHANNEL_CLASS: Record<InviteChannel, string> = {
  SMS: "bg-brand-blue-light text-brand-blue",
  EMAIL: "bg-brand-green-light text-brand-green",
  WECHAT: "bg-brand-green-light text-brand-green",
};

const STATUS_LABEL: Record<InviteCampaignStatus, string> = {
  DRAFT: "草稿",
  SENDING: "发送中",
  SENT: "已完成",
  FAILED: "失败",
  SCHEDULED: "已定时",
};

const STATUS_CLASS: Record<InviteCampaignStatus, string> = {
  DRAFT: "bg-gray-100 text-text-muted",
  SENDING: "bg-brand-blue-light text-brand-blue",
  SENT: "bg-brand-green-light text-brand-green",
  FAILED: "bg-brand-red-light text-brand-red",
  SCHEDULED: "bg-brand-purple-light text-brand-purple",
};

const RECORD_TABS = [
  { id: "all", label: "全部" },
  { id: "success", label: "成功" },
  { id: "failed", label: "失败" },
  { id: "skipped", label: "跳过" },
] as const;

const RECORD_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: "待发送", className: "bg-gray-100 text-text-muted" },
  SENT: { label: "已发送", className: "bg-brand-blue-light text-brand-blue" },
  DELIVERED: { label: "已送达", className: "bg-brand-blue-light text-brand-blue" },
  CLICKED: { label: "已点击", className: "bg-brand-green-light text-brand-green" },
  ACTIVATED: { label: "已激活", className: "bg-brand-green text-white" },
  FAILED: { label: "失败", className: "bg-brand-red-light text-brand-red" },
  SKIPPED: { label: "已跳过", className: "bg-gray-100 text-text-muted" },
};

function maskDestination(value: string) {
  if (!value) return "—";
  if (value.includes("@")) {
    const [user, domain] = value.split("@");
    return `${user.slice(0, 2)}***@${domain}`;
  }
  if (value.length >= 7) {
    return `${value.slice(0, 3)}****${value.slice(-4)}`;
  }
  return value;
}

function pct(count: number, base: number) {
  if (base <= 0) return 0;
  return Math.round((count / base) * 1000) / 10;
}

function formatEta(iso: string | null) {
  if (!iso) return null;
  const minutes = differenceInMinutes(new Date(iso), new Date());
  if (minutes <= 0) return "即将完成";
  if (minutes < 60) return `预计还需 ${minutes} 分钟`;
  return `预计还需 ${Math.ceil(minutes / 60)} 小时`;
}

type CampaignDetailClientProps = {
  eventId: string;
  campaignId: string;
};

export function CampaignDetailClient({
  eventId,
  campaignId,
}: CampaignDetailClientProps) {
  const { currentEvent } = useCurrentEvent();
  const [recordTab, setRecordTab] = useState<string>("all");
  const [cloneSheetOpen, setCloneSheetOpen] = useState(false);

  const { data: progress, isLoading } = useInviteCampaignProgress(
    eventId,
    campaignId,
  );
  const isSending = progress?.status === InviteCampaignStatus.SENDING;

  const { data: recordsData, isLoading: recordsLoading } = useInviteRecords(
    eventId,
    campaignId,
    recordTab,
    { refetchInterval: isSending ? 3000 : false },
  );

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

  const eventName = currentEvent?.name ?? "活动";
  const eventDate = useEventDateLabel(currentEvent?.startDate);

  async function handleRetryAll() {
    try {
      const result = await retryMutation.mutateAsync(campaignId);
      toast.success(`已重试 ${result.retried} 条失败记录`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重试失败");
    }
  }

  if (isLoading || !progress) {
    return (
      <AdminPageBody>
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="mb-6 h-48 w-full rounded-xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </AdminPageBody>
    );
  }

  const isComplete =
    progress.status === InviteCampaignStatus.SENT ||
    progress.status === InviteCampaignStatus.FAILED;

  return (
    <AdminPageBody>
      <header className="mb-6">
        <Link
          href={`/events/${eventId}/invite-campaigns`}
          className="mb-3 inline-flex items-center text-sm text-brand-blue hover:underline"
        >
          ← 邀请管理
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-[var(--admin-ink)]">
            {progress.name}
          </h1>
          <Badge className={CHANNEL_CLASS[progress.channel]}>
            {CHANNEL_LABEL[progress.channel]}
          </Badge>
          <Badge className={STATUS_CLASS[progress.status]}>
            {STATUS_LABEL[progress.status]}
          </Badge>
        </div>
      </header>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_260px]">
        <ProgressBoard progress={progress} isSending={isSending} />
        <SendTimeline progress={progress} />
      </div>

      <section className="mb-6">
        <div className="mb-4 flex flex-wrap gap-1.5">
          {RECORD_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={cn(
                "inline-flex h-[30px] items-center rounded-lg border px-3 text-[12.5px] transition-colors",
                recordTab === tab.id
                  ? "border-brand-blue bg-brand-blue text-white"
                  : "border-border-light bg-white text-text-muted hover:border-[#c5c2b8]",
              )}
              onClick={() => setRecordTab(tab.id)}
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
                  目标地址
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
                    暂无记录
                  </TableCell>
                </TableRow>
              ) : (
                recordsData?.records.map((record) => {
                  const statusMeta =
                    RECORD_STATUS[record.status] ?? RECORD_STATUS.PENDING;
                  const isFailed = record.status === InviteRecordStatus.FAILED;
                  const isActivated =
                    record.status === InviteRecordStatus.ACTIVATED;

                  return (
                    <TableRow
                      key={record.id}
                      className={cn(
                        "h-12",
                        isFailed && "bg-brand-red-light/50",
                        isActivated &&
                          "border-l-[3px] border-l-brand-green font-medium text-[var(--admin-ink)]",
                      )}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-7">
                            <AvatarFallback className="bg-brand-blue-light text-xs text-brand-blue">
                              {record.participant.name.slice(0, 1)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{record.participant.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={CHANNEL_CLASS[record.channel]}>
                          {CHANNEL_LABEL[record.channel]}
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
                        {isFailed && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-brand-blue"
                            disabled={retryMutation.isPending}
                            onClick={() => void handleRetryAll()}
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
      </section>

      <div className="flex flex-wrap gap-3">
        {progress.failed_count > 0 && (
          <Button
            variant="outline"
            className="border-brand-amber text-brand-amber hover:bg-brand-amber-light"
            disabled={retryMutation.isPending}
            onClick={() => void handleRetryAll()}
          >
            <RotateCcw className="mr-1 size-4" />
            重试所有失败（{progress.failed_count} 条）
          </Button>
        )}
        {isComplete && progress.failed_count === 0 && (
          <Button
            className="bg-brand-purple text-white hover:bg-brand-purple/90"
            onClick={() => setCloneSheetOpen(true)}
          >
            创建新一轮邀请
          </Button>
        )}
      </div>

      <CreateCampaignSheet
        eventId={eventId}
        open={cloneSheetOpen}
        onOpenChange={setCloneSheetOpen}
        eventName={eventName}
        eventDate={eventDate}
        organizerName="主办方"
        stats={{
          total: participantMeta?.total ?? 0,
          notInvited: participantMeta?.notInvited ?? 0,
          activated: participantMeta?.activated ?? 0,
        }}
        ticketTypes={participantMeta?.ticketTypes ?? []}
        cloneFrom={{
          name: progress.name,
          channel: progress.channel,
          customMessage: progress.custom_message ?? "",
          subject: progress.subject,
          templateId: progress.template_id,
          targetFilter: progress.target_filter,
        }}
        onSuccess={() => {
          toast.success("新一轮邀请活动已创建");
        }}
      />
    </AdminPageBody>
  );
}

function ProgressBoard({
  progress,
  isSending,
}: {
  progress: InviteCampaignProgress;
  isSending: boolean;
}) {
  const total = progress.total_target;
  const steps = [
    {
      label: "总目标",
      count: total,
      rate: 100,
      pulse: false,
    },
    {
      label: "已发送",
      count: progress.sent_count,
      rate: pct(progress.sent_count, total),
      pulse: isSending,
    },
    {
      label: "已送达",
      count: progress.delivered_count,
      rate: pct(progress.delivered_count, progress.sent_count || total),
      pulse: false,
    },
    {
      label: "已点击",
      count: progress.clicked_count,
      rate: pct(progress.clicked_count, progress.delivered_count || progress.sent_count || total),
      pulse: false,
    },
    {
      label: "已激活",
      count: progress.activated_count,
      rate: pct(progress.activated_count, progress.clicked_count || progress.delivered_count || total),
      pulse: false,
    },
  ];

  const eta = formatEta(progress.estimated_completion);

  return (
    <div className="rounded-xl border border-border-light bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--admin-ink)]">
        发送进度
      </h2>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-2">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-start gap-1 sm:gap-2">
            <div
              className={cn(
                "min-w-[56px] text-center",
                step.pulse && "animate-pulse",
              )}
            >
              <p className="text-xl font-semibold tabular-nums text-brand-blue">
                {step.count}
              </p>
              <p className="text-xs text-text-muted">{step.label}</p>
              {index > 0 && (
                <p className="text-[10px] text-text-tertiary">{step.rate}%</p>
              )}
            </div>
            {index < steps.length - 1 && (
              <ArrowRight className="mt-2 size-4 shrink-0 text-text-tertiary" />
            )}
          </div>
        ))}
      </div>

      {isSending && (
        <div className="space-y-2 border-t border-border-light pt-4">
          <Progress
            value={progress.send_percent}
            className="h-2"
            indicatorClassName="bg-brand-blue"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-[var(--admin-ink)]">
              已发送 {progress.sent_count} / {progress.total_target}（
              {progress.send_percent}%）
            </span>
            {eta && (
              <span className="text-text-muted">{eta}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type TimelineStepState = "done" | "active" | "pending";

function SendTimeline({ progress }: { progress: InviteCampaignProgress }) {
  const steps: Array<{
    label: string;
    time: string | null;
    state: TimelineStepState;
  }> = [
    {
      label: "创建时间",
      time: progress.created_at,
      state: "done",
    },
    {
      label: "开始发送",
      time: progress.started_at,
      state:
        progress.status === InviteCampaignStatus.SENDING
          ? "active"
          : progress.started_at
            ? "done"
            : "pending",
    },
    {
      label: "发送完成",
      time: progress.completed_at,
      state:
        progress.completed_at ||
        progress.status === InviteCampaignStatus.SENT
          ? "done"
          : "pending",
    },
  ];

  return (
    <div className="rounded-xl border border-border-light bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-[var(--admin-ink)]">
        发送时间线
      </h2>
      <ol className="space-y-4">
        {steps.map((step) => (
          <li key={step.label} className="flex gap-3">
            <TimelineIcon state={step.state} />
            <div>
              <p className="text-sm font-medium text-[var(--admin-ink)]">
                {step.label}
              </p>
              <p className="text-xs text-text-muted">
                {step.time
                  ? format(new Date(step.time), "yyyy/M/d HH:mm")
                  : step.state === "active"
                    ? "进行中…"
                    : "—"}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TimelineIcon({ state }: { state: TimelineStepState }) {
  if (state === "done") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-green-light">
        <Check className="size-3.5 text-brand-green" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-blue-light">
        <Loader2 className="size-3.5 animate-spin text-brand-blue" />
      </span>
    );
  }
  return (
    <span className="mt-0.5 size-6 shrink-0 rounded-full border-2 border-border-light bg-white" />
  );
}
