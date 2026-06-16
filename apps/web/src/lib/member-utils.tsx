import { formatDistanceToNow } from "date-fns";
import { zhCN } from "date-fns/locale";
import type { MemberTier, OrgJoinSource } from "@connectiq/database";
import { JOIN_SOURCE_LABELS } from "@/lib/member-constants";
import { cn } from "@/lib/utils";

export const JOIN_SOURCE_BADGE: Record<OrgJoinSource, string> = {
  PARTICIPATED_EVENT: "bg-brand-blue-light text-brand-blue",
  LEAD_CAPTURED: "bg-brand-green-light text-brand-green",
  INVITED: "bg-brand-purple-light text-brand-purple",
  FOLLOWED: "bg-brand-gold/20 text-brand-gold",
  QR_SCANNED: "bg-brand-amber-light text-brand-amber",
};

export const TIER_BADGE: Record<
  MemberTier,
  { className: string; label: string }
> = {
  VIP: { className: "bg-brand-gold/20 text-brand-gold", label: "👑 VIP" },
  ACTIVE: { className: "bg-brand-green-light text-brand-green", label: "● 活跃" },
  REGULAR: { className: "bg-content-bg text-text-muted", label: "普通" },
  DORMANT: { className: "bg-gray-100 text-gray-400", label: "💤 沉睡" },
};

export function formatRelativeActive(iso: string | null) {
  if (!iso) return "—";
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: zhCN });
}

export function JoinSourceBadge({ source }: { source: OrgJoinSource }) {
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
        JOIN_SOURCE_BADGE[source],
      )}
    >
      {JOIN_SOURCE_LABELS[source]}
    </span>
  );
}

export function TierBadge({ tier }: { tier: MemberTier }) {
  const config = TIER_BADGE[tier];
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
