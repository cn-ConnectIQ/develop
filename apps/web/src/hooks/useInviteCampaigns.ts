"use client";

import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  type InviteCampaignStatus as InviteCampaignStatusType,
  type InviteChannel as InviteChannelType,
  type InviteRecordStatus as InviteRecordStatusType,
} from "@/lib/invite/enums";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CreateInviteCampaignInput } from "@/lib/invite/schemas";

export type InviteCampaignItem = {
  id: string;
  name: string;
  channel: InviteChannelType;
  status: InviteCampaignStatusType;
  totalTarget: number;
  sentCount: number;
  deliveredCount: number;
  clickedCount: number;
  activatedCount: number;
  failedCount: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  customMessage: string | null;
  subject: string | null;
  templateId: string | null;
  creator: { id: string; name: string } | null;
  _count: { records: number };
};

export type InviteRecordItem = {
  id: string;
  channel: InviteChannelType;
  destination: string;
  status: InviteRecordStatusType;
  sentAt: string | null;
  clickedAt: string | null;
  activatedAt: string | null;
  errorMessage: string | null;
  participant: {
    id: string;
    name: string;
    company: string | null;
    phone: string | null;
    email: string | null;
    inviteStatus: string;
  };
};

async function fetchCampaigns(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/invite-campaigns`);
  if (!res.ok) throw new Error("加载邀请活动失败");
  const json = await res.json();
  return json.data as InviteCampaignItem[];
}

async function fetchCampaign(eventId: string, campaignId: string) {
  const res = await fetch(
    `/api/events/${eventId}/invite-campaigns/${campaignId}`,
  );
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return json.data as InviteCampaignItem & { progress: number };
}

async function fetchRecords(
  eventId: string,
  campaignId: string,
  params: { status?: string; page?: number },
) {
  const search = new URLSearchParams();
  if (params.status && params.status !== "all") {
    search.set("status", params.status);
  }
  search.set("page", String(params.page ?? 1));
  search.set("pageSize", "50");
  const res = await fetch(
    `/api/events/${eventId}/invite-campaigns/${campaignId}/records?${search}`,
  );
  if (!res.ok) throw new Error("加载记录失败");
  const json = await res.json();
  return {
    records: json.data as InviteRecordItem[],
    total: json.meta?.total as number,
  };
}

export type InviteCampaignProgress = {
  status: InviteCampaignStatusType;
  total_target: number;
  sent_count: number;
  delivered_count: number;
  clicked_count: number;
  activated_count: number;
  failed_count: number;
  skipped_count: number;
  pending_count: number;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  estimated_completion: string | null;
  send_percent: number;
  name: string;
  channel: InviteChannelType;
  custom_message: string | null;
  subject: string | null;
  template_id: string | null;
  target_filter: unknown;
};

async function fetchCampaignProgress(eventId: string, campaignId: string) {
  const res = await fetch(
    `/api/events/${eventId}/invite-campaigns/${campaignId}/progress`,
  );
  if (!res.ok) throw new Error("加载进度失败");
  const json = await res.json();
  return json.data as InviteCampaignProgress;
}

export function useInviteCampaigns(eventId: string) {
  return useQuery({
    queryKey: ["invite-campaigns", eventId],
    queryFn: () => fetchCampaigns(eventId),
  });
}

export function useInviteCampaign(eventId: string, campaignId: string | null) {
  return useQuery({
    queryKey: ["invite-campaign", eventId, campaignId],
    queryFn: () => fetchCampaign(eventId, campaignId!),
    enabled: !!campaignId,
  });
}

export function useInviteCampaignProgress(
  eventId: string,
  campaignId: string,
) {
  return useQuery({
    queryKey: ["invite-campaign-progress", eventId, campaignId],
    queryFn: () => fetchCampaignProgress(eventId, campaignId),
    refetchInterval: (query) =>
      query.state.data?.status === InviteCampaignStatus.SENDING ? 3000 : false,
  });
}

export function useInviteRecords(
  eventId: string,
  campaignId: string | null,
  status: string,
  options?: { refetchInterval?: number | false },
) {
  return useQuery({
    queryKey: ["invite-records", eventId, campaignId, status],
    queryFn: () => fetchRecords(eventId, campaignId!, { status }),
    enabled: !!campaignId,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCreateInviteCampaign(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateInviteCampaignInput) => {
      const res = await fetch(`/api/events/${eventId}/invite-campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "创建失败");
      return json.data as InviteCampaignItem;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invite-campaigns", eventId] });
    },
  });
}

export function useSendInviteCampaign(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(
        `/api/events/${eventId}/invite-campaigns/${campaignId}/send`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "发送失败");
      return json.data as { queued: number };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invite-campaigns", eventId] });
      void queryClient.invalidateQueries({ queryKey: ["participants", eventId] });
    },
  });
}

export function useRetryInviteCampaign(eventId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      const res = await fetch(
        `/api/events/${eventId}/invite-campaigns/${campaignId}/retry`,
        { method: "POST" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "重试失败");
      return json.data as { retried: number };
    },
    onSuccess: (_data, campaignId) => {
      void queryClient.invalidateQueries({ queryKey: ["invite-campaigns", eventId] });
      void queryClient.invalidateQueries({
        queryKey: ["invite-records", eventId, campaignId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["invite-campaign-progress", eventId, campaignId],
      });
    },
  });
}

export function aggregateFunnelStats(campaigns: InviteCampaignItem[]) {
  return campaigns.reduce(
    (acc, c) => ({
      sent: acc.sent + c.sentCount,
      delivered: acc.delivered + c.deliveredCount,
      clicked: acc.clicked + c.clickedCount,
      activated: acc.activated + c.activatedCount,
    }),
    { sent: 0, delivered: 0, clicked: 0, activated: 0 },
  );
}
