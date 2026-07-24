"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InviteCampaignsPageClient } from "@/app/(organizer)/events/[eventId]/invite-campaigns/invite-campaigns-client";
import { DirectInvitePanel } from "@/components/invites/DirectInvitePanel";
import { InviteAutoConfigPanel } from "@/components/invites/InviteAutoConfigPanel";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { CopySelfRegisterLinkButton } from "@/components/participants/CopySelfRegisterLinkButton";
import { useExperienceAccount } from "@/hooks/useExperienceAccount";
import { EXPERIENCE_BULK_INVITE_MESSAGE } from "@/lib/experience/experience-invite-messages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function InviteManagementClient({
  eventId,
  embedded = false,
}: {
  eventId: string;
  embedded?: boolean;
}) {
  const searchParams = useSearchParams();
  const { data: experienceProfile } = useExperienceAccount();
  const experienceBulkBlocked = Boolean(experienceProfile?.isActiveExperience);
  const tabParam = searchParams.get("inviteTab");
  const [activeTab, setActiveTab] = useState(
    tabParam === "records" ? "records" : "send",
  );

  useEffect(() => {
    if (tabParam === "records") setActiveTab("records");
  }, [tabParam]);

  const body = (
    <>
      {!embedded && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--admin-ink)]">邀请管理</h1>
            <p className="mt-1 text-sm text-text-muted">
              一对一 / 批量发送固定模板邀请；新参会者可在开启邀请体系后自动触发
            </p>
            {experienceBulkBlocked && (
              <p className="mt-2 text-xs text-brand-amber">
                {EXPERIENCE_BULK_INVITE_MESSAGE}
              </p>
            )}
          </div>
          <CopySelfRegisterLinkButton eventId={eventId} />
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="send">发起邀请</TabsTrigger>
          <TabsTrigger value="records">邀请记录</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4 space-y-6">
          <InviteAutoConfigPanel eventId={eventId} />
          <DirectInvitePanel eventId={eventId} />
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <InviteCampaignsPageClient eventId={eventId} embedded />
        </TabsContent>
      </Tabs>
    </>
  );

  if (embedded) return <div className="mt-2">{body}</div>;
  return <AdminPageBody>{body}</AdminPageBody>;
}
