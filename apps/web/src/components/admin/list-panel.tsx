import type { MouseEvent, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** 主从布局侧栏标准宽度 */
export const LIST_PANEL_WIDTH = "w-[300px]";

export function ListPanel({
  children,
  className,
  border = "right",
}: {
  children: ReactNode;
  className?: string;
  border?: "left" | "right" | "none";
}) {
  return (
    <aside
      className={cn(
        LIST_PANEL_WIDTH,
        "flex shrink-0 flex-col bg-content-bg",
        border === "right" && "border-r border-border-light",
        border === "left" && "border-l border-border-light",
        className,
      )}
    >
      {children}
    </aside>
  );
}

export function ListPanelHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "shrink-0 border-b border-border-light bg-white p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ListPanelBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex-1 overflow-y-auto px-2 py-2", className)}>
      {children}
    </div>
  );
}

export type FilterTabOption<T extends string = string> = {
  key: T;
  label: string;
  count?: number;
};

export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
  "aria-label": ariaLabel = "筛选",
}: {
  tabs: FilterTabOption<T>[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      className={cn(
        "flex rounded-lg border border-border-light bg-content-bg p-0.5",
        className,
      )}
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
            value === tab.key
              ? "bg-white text-text shadow-sm"
              : "text-text-muted hover:text-text",
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                "tabular-nums",
                value === tab.key ? "text-text-muted" : "text-text-tertiary",
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export type ListItemAccent = "live" | "selected" | "none";

export function SelectableListItem({
  selected,
  accent = "none",
  faded,
  icon: Icon,
  iconClassName,
  typeLabel,
  title,
  meta,
  statusLabel,
  statusVariant = "default",
  onClick,
  actions,
  className,
}: {
  selected?: boolean;
  accent?: ListItemAccent;
  faded?: boolean;
  icon: LucideIcon;
  iconClassName?: string;
  typeLabel: string;
  title: string;
  meta?: string;
  statusLabel?: string;
  statusVariant?: "live" | "draft" | "ended" | "default";
  onClick?: () => void;
  actions?: ReactNode;
  className?: string;
}) {
  const showLiveAccent = accent === "live" || statusVariant === "live";
  const showSelectedAccent = accent === "selected" || selected;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter") onClick();
            }
          : undefined
      }
      className={cn(
        "group relative rounded-lg border px-3 py-2.5 transition-all",
        onClick && "cursor-pointer",
        faded && "opacity-55 hover:opacity-75",
        showSelectedAccent
          ? "border-brand-blue/40 bg-white shadow-sm ring-1 ring-brand-blue/15"
          : "border-transparent bg-white hover:border-border-light hover:shadow-sm",
        className,
      )}
    >
      {showSelectedAccent && (
        <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-brand-blue" />
      )}
      {showLiveAccent && !showSelectedAccent && (
        <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-brand-amber" />
      )}

      <div className="flex gap-2.5 pl-1">
        <div
          className={cn(
            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md",
            iconClassName ?? "bg-gray-100 text-text-muted",
          )}
        >
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="text-[11px] font-medium text-text-muted">
              {typeLabel}
            </span>
            {statusLabel && (
              <ListStatusBadge label={statusLabel} variant={statusVariant} />
            )}
          </div>

          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-medium text-text">
            {title}
          </p>

          {(meta || actions) && (
            <div className="mt-1.5 flex items-center justify-between gap-2">
              {meta ? (
                <span className="text-[11px] text-text-muted">{meta}</span>
              ) : (
                <span />
              )}
              {actions && (
                <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                  {actions}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ListStatusBadge({
  label,
  variant = "default",
  pulse,
}: {
  label: string;
  variant?: "live" | "draft" | "ended" | "paused" | "active" | "default";
  pulse?: boolean;
}) {
  if (variant === "live" || variant === "active") {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 text-[10px] font-medium",
          variant === "live" ? "text-brand-amber" : "text-brand-green",
        )}
      >
        {(pulse ?? variant === "live") && (
          <span
            className={cn(
              "size-1.5 rounded-full",
              variant === "live" ? "bg-brand-amber" : "bg-brand-green",
              pulse && "animate-pulse",
            )}
          />
        )}
        {label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "shrink-0 text-[10px]",
        variant === "draft" || variant === "ended"
          ? "text-text-tertiary"
          : "text-text-muted",
      )}
    >
      {label}
    </span>
  );
}

export function ListEmptyState({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "px-2 py-8 text-center text-xs text-text-muted",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function ListSectionHeader({
  title,
  count,
  dotClassName,
}: {
  title: string;
  count?: number;
  dotClassName?: string;
}) {
  return (
    <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-text">
      {dotClassName && (
        <span
          className={cn("size-1.5 rounded-full", dotClassName)}
          aria-hidden
        />
      )}
      {title}
      {count !== undefined && (
        <span className="font-normal text-text-muted">{count}</span>
      )}
    </h2>
  );
}

/** 内容区全宽资源卡片（展位互动、抽奖列表等） */
export function ResourceListCard({
  icon,
  iconContainerClassName,
  title,
  subtitle,
  status,
  faded,
  onClick,
  footer,
  trailing,
  className,
}: {
  icon: ReactNode;
  iconContainerClassName?: string;
  title: string;
  subtitle?: string;
  status?: { label: string; variant: "live" | "draft" | "ended" | "paused" | "active" | "default" };
  faded?: boolean;
  onClick?: () => void;
  footer?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border-light bg-white p-4 transition-shadow hover:shadow-sm",
        faded && "opacity-60",
        onClick && "cursor-pointer",
        className,
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter") onClick();
            }
          : undefined
      }
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            iconContainerClassName ?? "bg-gray-100 text-text-muted",
          )}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-medium leading-snug text-text">{title}</p>
            {status && (
              <ListStatusBadge label={status.label} variant={status.variant} />
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          )}
        </div>

        {trailing}
      </div>

      {footer && <div className="mt-3 flex flex-wrap gap-2">{footer}</div>}
    </div>
  );
}

export function ListIconAction({
  title,
  onClick,
  children,
  className,
}: {
  title: string;
  onClick: (e: MouseEvent) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      className={cn(
        "rounded p-0.5 text-text-muted hover:bg-content-bg",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick(e);
      }}
    >
      {children}
    </button>
  );
}
