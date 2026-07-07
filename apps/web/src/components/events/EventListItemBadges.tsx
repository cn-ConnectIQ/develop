import { getEventDisplayTypeLabel } from "@/lib/event-utils";
import { cn } from "@/lib/utils";
import type { EventListItem } from "@/hooks/useEvents";

type EventBadgeSource = Pick<
  EventListItem,
  "listRole" | "type" | "category" | "activityType"
>;

export function getEventListRoleLabel(
  event: Pick<EventListItem, "listRole">,
): "参展" | "主办" | null {
  if (event.listRole === "EXHIBITOR") return "参展";
  if (event.listRole === "HOST") return "主办";
  return null;
}

export function EventListItemBadges({
  event,
  layout = "stack",
}: {
  event: EventBadgeSource;
  layout?: "stack" | "row";
}) {
  const roleLabel = getEventListRoleLabel(event);
  const typeLabel = getEventDisplayTypeLabel(event);

  return (
    <div
      className={cn(
        "flex shrink-0 gap-1",
        layout === "stack" ? "flex-col items-end" : "flex-row items-center",
      )}
    >
      {roleLabel ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
            event.listRole === "EXHIBITOR"
              ? "bg-brand-blue-light text-brand-blue"
              : "bg-brand-green-light text-brand-green",
          )}
        >
          {roleLabel}
        </span>
      ) : null}
      <span className="rounded-sm bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">
        {typeLabel}
      </span>
    </div>
  );
}
