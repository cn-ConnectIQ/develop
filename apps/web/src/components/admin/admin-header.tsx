import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AdminHeaderProps = {
  title: string;
  description?: string;
  breadcrumb?: string[];
  actions?: ReactNode;
};

export function AdminHeader({
  title,
  description,
  breadcrumb,
  actions,
}: AdminHeaderProps) {
  return (
    <header className="admin-header">
      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <div className="mb-0.5 flex items-center gap-1.5 text-[12px] text-text-tertiary">
            {breadcrumb.map((item, index) => (
              <span key={item} className="flex items-center gap-1.5">
                {index > 0 && <span>/</span>}
                <span>{item}</span>
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3">
          <h1 className="truncate text-[18px] font-semibold text-[var(--admin-ink)]">
            {title}
          </h1>
          {description && (
            <span className="hidden text-[13px] text-text-muted sm:inline">
              {description}
            </span>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

type AdminPageProps = {
  children: ReactNode;
  className?: string;
};

export function AdminPage({ children, className }: AdminPageProps) {
  return (
    <div className={cn("admin-main", className)}>
      {children}
    </div>
  );
}

export function AdminContent({ children, className }: AdminPageProps) {
  return (
    <div className={cn("admin-content", className)}>
      <div className="admin-content-inner space-y-6">{children}</div>
    </div>
  );
}

type SectionCardProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
};

export function SectionCard({
  title,
  description,
  action,
  children,
  id,
}: SectionCardProps) {
  return (
    <section id={id} className="admin-card overflow-hidden">
      <div className="flex items-start justify-between gap-4 border-b border-border-light/60 px-5 py-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--admin-ink)]">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

type AiInsightProps = {
  title?: string;
  children: ReactNode;
};

export function AiInsight({
  title = "AI 洞察",
  children,
}: AiInsightProps) {
  return (
    <div id="ai" className="admin-ai-insight">
      <div className="mb-2 flex items-center gap-2">
        <span className="rounded-md bg-brand-purple px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
          AI
        </span>
        <h3 className="text-[14px] font-semibold text-brand-purple">{title}</h3>
      </div>
      <div className="text-[13px] leading-relaxed text-[#3d3a7a]">{children}</div>
    </div>
  );
}
