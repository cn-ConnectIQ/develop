"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import type { AdminUser } from "@/components/admin/admin-sidebar";
import { EventProvider, useCurrentEvent } from "@/hooks/useCurrentEvent";
import { useIsEventReviewLocked } from "@/hooks/useEventReviewLock";
import { EventReviewBanner } from "@/components/events/EventReviewBanner";
import { AdminContent } from "@/components/admin/admin-header";
import { cn } from "@/lib/utils";

type AdminLayoutInnerProps = {
  user: AdminUser;
  children: ReactNode;
  showHeader?: boolean;
  headerTitle?: string;
  headerActions?: ReactNode;
};

function AdminLayoutInner({
  user,
  children,
  showHeader = true,
  headerTitle,
  headerActions,
}: AdminLayoutInnerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { currentEventId, currentEvent } = useCurrentEvent();
  const isReviewLocked = useIsEventReviewLocked(currentEventId ?? "");

  return (
    <div className="flex h-screen overflow-hidden bg-content-bg">
      <Sidebar
        user={user}
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        eventId={currentEventId}
        eventName={currentEvent?.name}
        eventType={currentEvent?.type}
        reviewLocked={isReviewLocked}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {showHeader && (
          <Header
            user={user}
            title={headerTitle}
            actions={headerActions}
          />
        )}

        {isReviewLocked && currentEventId && <EventReviewBanner />}

        <main
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden",
            isReviewLocked && currentEventId && "pt-12",
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

type AdminLayoutProps = {
  user: AdminUser;
  children: ReactNode;
  withEventProvider?: boolean;
  showHeader?: boolean;
};

export function AdminLayout({
  user,
  children,
  withEventProvider = true,
  showHeader = true,
}: AdminLayoutProps) {
  const content = (
    <AdminLayoutInner user={user} showHeader={showHeader}>
      {children}
    </AdminLayoutInner>
  );

  if (withEventProvider) {
    return <EventProvider>{content}</EventProvider>;
  }

  return content;
}

export function AdminPageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <AdminContent className={className}>{children}</AdminContent>;
}
