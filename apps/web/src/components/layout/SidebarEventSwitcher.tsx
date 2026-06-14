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
import { getEventPhase } from "@/lib/event-utils";
import { cn } from "@/lib/utils";
import { UserRole } from "@connectiq/types";

type SidebarEventSwitcherProps = {
  role: string;
};

export function SidebarEventSwitcher({ role }: SidebarEventSwitcherProps) {
  const { events, currentEvent, setCurrentEventId, isLoading } =
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

  return (
    <div className="admin-sb-ctx">
      <Popover>
        <PopoverTrigger className="admin-sb-switch">
          <span className={cn("admin-ctx-dot", dotColor)} />
          <span className="min-w-0 flex-1 truncate font-medium">
            {isLoading ? (
              "加载活动..."
            ) : (
              <>
                <span className="text-white/55">当前活动：</span>
                {currentEvent?.name ?? "选择活动"}
              </>
            )}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-[#8a90b4]" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[280px] p-0">
          <Command>
            <CommandInput placeholder="搜索活动..." />
            <CommandList>
              <CommandEmpty>未找到活动</CommandEmpty>
              <CommandGroup heading="活动">
                {events.map((event) => (
                  <CommandItem
                    key={event.id}
                    onSelect={() => setCurrentEventId(event.id)}
                    className={cn(
                      currentEvent?.id === event.id &&
                        "bg-brand-blue-light text-brand-blue",
                    )}
                  >
                    <span
                      className={cn(
                        "mr-2 size-2 rounded-full",
                        getEventPhase({
                          status: event.status as "DRAFT" | "PUBLISHED" | "ARCHIVED",
                          startDate: event.startDate
                            ? new Date(event.startDate)
                            : null,
                          endDate: event.endDate
                            ? new Date(event.endDate)
                            : null,
                        }) === "live"
                          ? "bg-brand-green"
                          : "bg-brand-blue",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{event.name}</p>
                      {event.startDate && (
                        <p className="text-xs text-text-muted">
                          {format(new Date(event.startDate), "yyyy/M/d", {
                            locale: zhCN,
                          })}
                        </p>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
