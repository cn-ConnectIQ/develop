"use client";

import Link from "next/link";
import { format } from "date-fns";
import { Copy, MoreHorizontal, RotateCcw } from "lucide-react";
import { InviteCampaignStatus, InviteChannel } from "@/lib/invite/enums";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { InviteCampaignItem } from "@/hooks/useInviteCampaigns";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

type CampaignCardProps = {
  eventId: string;
  campaign: InviteCampaignItem;
  onRetry?: (id: string) => void;
};

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

function pct(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

export function CampaignCard({
  eventId,
  campaign,
  onRetry,
}: CampaignCardProps) {
  const total = campaign.totalTarget || campaign._count.records || 1;
  const activationRate = pct(campaign.activatedCount, total);
  const sendingPct =
    campaign.status === InviteCampaignStatus.SENDING
      ? Math.max(0, 100 - pct(campaign.sentCount, total))
      : 0;

  const segments = [
    {
      label: "发送中",
      pct: sendingPct,
      className: "bg-gray-300",
    },
    {
      label: "已发送",
      pct: pct(campaign.sentCount, total),
      className: "bg-brand-blue",
    },
    {
      label: "已送达",
      pct: pct(campaign.deliveredCount, total),
      className: "bg-brand-blue/60",
    },
    {
      label: "已点击",
      pct: pct(campaign.clickedCount, total),
      className: "bg-brand-green/70",
    },
    {
      label: "已激活",
      pct: pct(campaign.activatedCount, total),
      className: "bg-brand-green",
    },
  ];

  const sentTime =
    campaign.startedAt ??
    campaign.scheduledAt ??
    campaign.createdAt;

  return (
    <div className="mb-3 rounded-xl border border-border-light bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-[var(--admin-ink)]">
            {campaign.name}
          </h3>
          <Badge className={CHANNEL_CLASS[campaign.channel]}>
            {CHANNEL_LABEL[campaign.channel]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_CLASS[campaign.status]}>
            {STATUS_LABEL[campaign.status]}
          </Badge>
          <span className="text-xs text-text-muted">
            {format(new Date(sentTime), "yyyy/M/d HH:mm")}
          </span>
        </div>
      </div>

      <div className="mb-3 flex gap-0.5 overflow-hidden rounded-full">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={cn("h-1.5 transition-all", seg.className)}
            style={{ width: `${Math.max(seg.pct, seg.pct > 0 ? 2 : 0)}%` }}
          />
        ))}
      </div>
      <div className="mb-4 grid grid-cols-5 gap-1">
        {segments.map((seg) => (
          <div key={seg.label} className="text-center">
            <p className="text-xs text-text-muted">{seg.label}</p>
            <p className="text-xs tabular-nums text-text-muted">{seg.pct}%</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-text-muted">目标 {total} 人</span>
          <span className="font-medium text-brand-green">
            激活 {campaign.activatedCount} 人（{activationRate}%）
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Link
            href={`/events/${eventId}/invite-campaigns/${campaign.id}`}
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "h-8 text-xs",
            )}
          >
            查看详情
          </Link>
          {campaign.failedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-brand-blue"
              onClick={() => onRetry?.(campaign.id)}
            >
              <RotateCcw className="mr-1 size-3" />
              重试失败
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex size-8 items-center justify-center rounded-lg text-text-muted hover:bg-content">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(campaign.id);
                  toast.success("已复制活动 ID");
                }}
              >
                <Copy className="size-4" />
                复制 ID
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => toast.info("归档功能将在后续版本开放")}
              >
                归档
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
