"use client";

import { InviteCampaignsPageClient } from "@/app/(organizer)/events/[eventId]/invite-campaigns/invite-campaigns-client";
import { DirectInvitePanel } from "@/components/invites/DirectInvitePanel";
import { AdminPageBody } from "@/components/layout/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function InviteManagementClient({ eventId }: { eventId: string }) {
  return (
    <AdminPageBody>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-[var(--admin-ink)]">邀请管理</h1>
        <p className="mt-1 text-sm text-text-muted">
          发起邀请、管理邀请状态，支持为参会者打身份标签（VIP / 演讲者等）
        </p>
      </div>

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">发起邀请</TabsTrigger>
          <TabsTrigger value="records">邀请记录</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="mt-4">
          <DirectInvitePanel eventId={eventId} />
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <InviteCampaignsPageClient eventId={eventId} embedded />
        </TabsContent>
      </Tabs>
    </AdminPageBody>
  );
}
