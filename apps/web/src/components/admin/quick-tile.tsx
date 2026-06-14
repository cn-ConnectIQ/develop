import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type QuickTileProps = {
  title: string;
  description?: string;
  href: string;
  icon: LucideIcon;
  className?: string;
};

export function QuickTile({
  title,
  description,
  href,
  icon: Icon,
  className,
}: QuickTileProps) {
  return (
    <Link href={href} className={cn("admin-qtile group", className)}>
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue-light text-brand-blue">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-medium text-[var(--admin-ink)]">
          {title}
        </p>
        {description && (
          <p className="mt-0.5 truncate text-[12px] text-text-tertiary">
            {description}
          </p>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

type QuickTileGridProps = {
  children: React.ReactNode;
};

export function QuickTileGrid({ children }: QuickTileGridProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}
