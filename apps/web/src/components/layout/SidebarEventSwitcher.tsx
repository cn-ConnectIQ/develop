"use client";

import { ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCurrentEvent } from "@/contexts/event-context";
import { EventListItemBadges, getEventListRoleLabel } from "@/components/events/EventListItemBadges";
import { getEventPhase } from "@/lib/event-utils";
import { cn } from "@/lib/utils";
import { UserRole } from "@connectiq/types";

type SidebarEventSwitcherProps = {
  role: string;
};

export function SidebarEventSwitcher({ role }: SidebarEventSwitcherProps) {
  const { events, currentEvent, currentEventId, eventDisplayName, setCurrentEventId } =
    useCurrentEvent();

  const showSwitcher =
    role === UserRole.ORGANIZER ||
    role === UserRole.PLATFORM_ADMIN ||
    role === UserRole.EXPO_ORGANIZER;

  if (!showSwitcher) return null;

  const phase = currentEvent
    ? getEventPhase({
        status: currentEvent.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        startDate: currentEvent.startDate
          ? new Date(currentEvent.startDate)
          : null,
        endDate: currentEvent.endDate
          ? new Date(currentEvent.endDate)
          : null,
      })
    : null;

  const dotColor =
    phase === "live"
      ? "bg-brand-green"
      : phase === "ended"
        ? "bg-text-tertiary"
        : "bg-brand-blue";

  const hostEvents = events.filter((e) => e.listRole === "HOST");
  const managedEvents = events.filter((e) => e.listRole === "MANAGER");
  const exhibitorEvents = events.filter((e) => e.listRole === "EXHIBITOR");
  const currentRoleLabel = currentEvent
    ? getEventListRoleLabel(currentEvent)
    : null;

  const displayName = eventDisplayName;

  function renderEventItem(event: (typeof events)[number]) {
    return (
      <CommandItem
        key={event.id}
        onSelect={() => setCurrentEventId(event.id)}
        className={cn(
          "flex items-center gap-2",
          currentEvent?.id === event.id &&
            "bg-brand-blue-light text-brand-blue",
        )}
      >
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            getEventPhase({
              status: event.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
              startDate: event.startDate ? new Date(event.startDate) : null,
              endDate: event.endDate ? new Date(event.endDate) : null,
            }) === "live"
              ? "bg-brand-green"
              : "bg-brand-blue",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{event.name}</p>
          <p className="text-xs text-text-muted">
            {event.startDate
              ? format(new Date(event.startDate), "yyyy/M/d", {
                  locale: zhCN,
                })
              : "日期待定"}
            {event.listRole === "EXHIBITOR" && event.boothCode
              ? ` · 展位 ${event.boothCode}`
              : ""}
          </p>
        </div>
        <EventListItemBadges event={event} />
      </CommandItem>
    );
  }

  return (
    <div className="admin-sb-ctx">
      <Popover>
        <PopoverTrigger className="admin-sb-switch">
          <span className={cn("admin-ctx-dot", dotColor)} />
          <span className="min-w-0 flex-1 truncate font-medium">
            {currentEventId ? (
              <>
                <span className="text-text-tertiary">当前活动：</span>
                {displayName}
              </>
            ) : (
              displayName
            )}
            {currentRoleLabel ? (
              <span className="ml-1 text-[11px] font-normal text-brand-blue">
                · {currentRoleLabel}
              </span>
            ) : null}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-text-tertiary" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] p-0">
          <Command>
            <CommandInput placeholder="搜索活动..." />
            <CommandList>
              <CommandEmpty>未找到活动</CommandEmpty>
              {hostEvents.length > 0 ? (
                <CommandGroup heading="主办">
                  {hostEvents.map(renderEventItem)}
                </CommandGroup>
              ) : null}
              {managedEvents.length > 0 ? (
                <CommandGroup heading="管理">
                  {managedEvents.map(renderEventItem)}
                </CommandGroup>
              ) : null}
              {exhibitorEvents.length > 0 ? (
                <CommandGroup heading="参展">
                  {exhibitorEvents.map(renderEventItem)}
                </CommandGroup>
              ) : null}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
