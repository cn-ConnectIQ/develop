"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronDown } from "lucide-react";
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
import { EventStatusBadge } from "@/components/admin/status-badge";
import { useCurrentEvent } from "@/hooks/useCurrentEvent";
import { getEventPhase } from "@/lib/event-utils";
import { getRoleTheme } from "@/lib/role-theme";
import { cn } from "@/lib/utils";
import { UserRole } from "@connectiq/types";

type EventSwitcherProps = {
  role: string;
};

export function EventSwitcher({ role }: EventSwitcherProps) {
  const [open, setOpen] = useState(false);
  const { events, currentEvent, setCurrentEventId, isLoading } =
    useCurrentEvent();
  const theme = getRoleTheme(role as UserRole);

  const showSwitcher =
    role === UserRole.ORGANIZER ||
    role === UserRole.PLATFORM_ADMIN ||
    role === UserRole.EXPO_ORGANIZER;

  const activeHighlight =
    theme.accent === "green"
      ? "bg-brand-green-light text-brand-green"
      : theme.accent === "amber"
        ? "bg-brand-amber-light text-brand-amber"
        : "bg-brand-blue-light text-brand-blue";

  const grouped = useMemo(() => {
    const live: typeof events = [];
    const draft: typeof events = [];
    const ended: typeof events = [];

    for (const event of events) {
      const phase = getEventPhase({
        status: event.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
        startDate: event.startDate ? new Date(event.startDate) : null,
        endDate: event.endDate ? new Date(event.endDate) : null,
      });
      if (phase === "live") live.push(event);
      else if (phase === "ended") ended.push(event);
      else draft.push(event);
    }

    return { live, draft, ended };
  }, [events]);

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

  const dotClass =
    phase === "live"
      ? "bg-brand-green"
      : phase === "ended"
        ? "bg-text-tertiary"
        : theme.accent === "green"
          ? "bg-brand-green"
          : "bg-brand-blue";

  if (!showSwitcher) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-[34px] w-[320px] max-w-[40vw] shrink-0 items-center justify-between rounded-lg border border-border-light bg-white px-3 text-left text-sm font-normal shadow-none">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn("size-1.5 shrink-0 rounded-full", dotClass)} />
          <span className="truncate text-sm font-semibold text-[var(--admin-ink)]">
            {isLoading
              ? "加载活动..."
              : (currentEvent?.name ?? "选择活动")}
          </span>
          {currentEvent && (
            <EventStatusBadge status={currentEvent.status} />
          )}
        </span>
        <ChevronDown className="size-4 shrink-0 text-text-tertiary" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-0">
        <Command>
          <CommandInput placeholder="搜索活动..." />
          <CommandList>
            <CommandEmpty>未找到活动</CommandEmpty>
            {grouped.live.length > 0 && (
              <CommandGroup heading="进行中">
                {grouped.live.map((event) => (
                  <EventCommandItem
                    key={event.id}
                    event={event}
                    active={currentEvent?.id === event.id}
                    activeHighlight={activeHighlight}
                    onSelect={() => {
                      setCurrentEventId(event.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </CommandGroup>
            )}
            {grouped.draft.length > 0 && (
              <CommandGroup heading="筹备中">
                {grouped.draft.map((event) => (
                  <EventCommandItem
                    key={event.id}
                    event={event}
                    active={currentEvent?.id === event.id}
                    activeHighlight={activeHighlight}
                    onSelect={() => {
                      setCurrentEventId(event.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </CommandGroup>
            )}
            {grouped.ended.length > 0 && (
              <CommandGroup heading="已结束">
                {grouped.ended.map((event) => (
                  <EventCommandItem
                    key={event.id}
                    event={event}
                    active={currentEvent?.id === event.id}
                    activeHighlight={activeHighlight}
                    onSelect={() => {
                      setCurrentEventId(event.id);
                      setOpen(false);
                    }}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EventCommandItem({
  event,
  active,
  activeHighlight,
  onSelect,
}: {
  event: {
    id: string;
    name: string;
    status: string;
    startDate: string | null;
  };
  active: boolean;
  activeHighlight: string;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      onSelect={onSelect}
      className={cn(
        "flex items-center justify-between gap-2",
        active && activeHighlight,
      )}
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{event.name}</p>
        {event.startDate && (
          <p className="text-xs text-text-muted">
            {format(new Date(event.startDate), "yyyy/M/d", { locale: zhCN })}
          </p>
        )}
      </div>
      <EventStatusBadge status={event.status} />
    </CommandItem>
  );
}
