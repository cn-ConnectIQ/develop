import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PageHeadProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHead({
  title,
  description,
  actions,
  className,
}: PageHeadProps) {
  return (
    <div className={cn("admin-page-head", className)}>
      <div className="min-w-0">
        <h1 className="admin-page-title">{title}</h1>
        {description && (
          <p className="admin-page-subtitle">{description}</p>
        )}
      </div>
      {actions && <div className="admin-page-actions">{actions}</div>}
    </div>
  );
}
