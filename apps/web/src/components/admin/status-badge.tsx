import { cn } from "@/lib/utils";

const eventStatusLabel: Record<string, string> = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  ARCHIVED: "已归档",
};

const eventStatusStyle: Record<string, string> = {
  DRAFT: "admin-badge-soft-amber",
  PUBLISHED: "admin-badge-green",
  ARCHIVED: "admin-badge-soft-gray",
};

const eventTypeLabel: Record<string, string> = {
  CONFERENCE: "会议",
  EXPO: "展会",
};

const leadStatusLabel: Record<string, string> = {
  NEW: "新线索",
  CONTACTED: "已联系",
  QUALIFIED: "已确认",
  LOST: "已流失",
  WON: "已成交",
};

const leadStatusStyle: Record<string, string> = {
  NEW: "admin-badge-soft-blue",
  CONTACTED: "admin-badge-soft-purple",
  QUALIFIED: "admin-badge-soft-green",
  LOST: "admin-badge-soft-gray",
  WON: "admin-badge-green",
};

const boothStatusLabel: Record<string, string> = {
  AVAILABLE: "可预订",
  BOOKED: "已预订",
  OCCUPIED: "已占用",
};

const boothStatusStyle: Record<string, string> = {
  AVAILABLE: "admin-badge-soft-green",
  BOOKED: "admin-badge-soft-amber",
  OCCUPIED: "admin-badge-soft-blue",
};

type StatusBadgeProps = {
  label: string;
  className?: string;
};

function StatusBadge({ label, className }: StatusBadgeProps) {
  return (
    <span className={cn("admin-badge", className)}>
      {label}
    </span>
  );
}

export function EventStatusBadge({ status }: { status: string }) {
  const solidStatuses = ["PUBLISHED"];
  return (
    <StatusBadge
      label={eventStatusLabel[status] ?? status}
      className={
        solidStatuses.includes(status)
          ? "admin-badge-green"
          : (eventStatusStyle[status] ?? "admin-badge-soft-gray")
      }
    />
  );
}

export function EventTypeBadge({ type }: { type: string }) {
  return (
    <StatusBadge
      label={eventTypeLabel[type] ?? type}
      className="admin-badge-soft-blue"
    />
  );
}

export function LeadStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      label={leadStatusLabel[status] ?? status}
      className={leadStatusStyle[status] ?? "bg-muted text-text-muted"}
    />
  );
}

export function BoothStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      label={boothStatusLabel[status] ?? status}
      className={boothStatusStyle[status] ?? "bg-muted text-text-muted"}
    />
  );
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
