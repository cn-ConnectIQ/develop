"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import {
  CreateCampaignForm,
  useEventDateLabel,
  type CreateCampaignCloneFrom,
} from "@/components/invites/CreateCampaignForm";
import { InviteChannel } from "@/lib/invite/enums";
import { useCurrentEvent } from "@/contexts/event-context";

async function fetchParticipantMeta(eventId: string) {
  const res = await fetch(`/api/events/${eventId}/participants?limit=1`);
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return json.meta as {
    total: number;
    notInvited: number;
    activated: number;
    ticketTypes: Array<{ id: string; name: string }>;
  };
}

async function fetchCloneCampaign(eventId: string, campaignId: string) {
  const res = await fetch(
    `/api/events/${eventId}/invite-campaigns/${campaignId}`,
  );
  if (!res.ok) throw new Error("加载失败");
  const json = await res.json();
  return json.data as {
    name: string;
    channel: InviteChannel;
    customMessage: string | null;
    subject: string | null;
    templateId: string | null;
  };
}

export function CreateCampaignPageClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentEvent } = useCurrentEvent();

  const idsParam = searchParams.get("ids");
  const initialParticipantIds = idsParam
    ? idsParam.split(",").filter(Boolean)
    : undefined;
  const cloneCampaignId = searchParams.get("cloneCampaignId");

  const eventName = currentEvent?.name ?? "活动";
  const eventDate = useEventDateLabel(currentEvent?.startDate);

  const { data: meta, isLoading: metaLoading } = useQuery({
    queryKey: ["participants-meta", eventId],
    queryFn: () => fetchParticipantMeta(eventId),
  });

  const { data: cloneSource } = useQuery({
    queryKey: ["invite-clone", eventId, cloneCampaignId],
    queryFn: () => fetchCloneCampaign(eventId, cloneCampaignId!),
    enabled: Boolean(cloneCampaignId),
  });

  const cloneFrom: CreateCampaignCloneFrom | undefined = cloneSource
    ? {
        name: cloneSource.name,
        channel: cloneSource.channel,
        customMessage: cloneSource.customMessage ?? "",
        subject: cloneSource.subject,
        templateId: cloneSource.templateId,
      }
    : undefined;

  function handleSuccess() {
    router.push(`/events/${eventId}/invite?tab=records`);
  }

  return (
    <AdminPage>
      <AdminHeader
        title="邀请参会者加入 ConnectIQ"
        description={eventName}
        breadcrumb={["参与人员管理", "发起邀请"]}
        actions={
          <Link
            href={`/events/${eventId}/participants`}
            className="text-sm text-brand-blue hover:underline"
          >
            ← 返回参与人员管理
          </Link>
        }
      />
      <AdminContent>
        {metaLoading || !meta ? (
          <p className="py-12 text-center text-sm text-text-muted">加载中…</p>
        ) : (
          <CreateCampaignForm
            eventId={eventId}
            eventName={eventName}
            eventDate={eventDate}
            organizerName="主办方"
            stats={{
              total: meta.total,
              notInvited: meta.notInvited,
              activated: meta.activated,
            }}
            ticketTypes={meta.ticketTypes ?? []}
            initialParticipantIds={initialParticipantIds}
            cloneFrom={cloneFrom}
            onSuccess={handleSuccess}
          />
        )}
      </AdminContent>
    </AdminPage>
  );
}
