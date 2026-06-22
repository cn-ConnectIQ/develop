"use client";

import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  getOrgTypeBadgeStyle,
  getOrgTypeFullName,
  getOrgTypeIcon,
  getOrgTypeShortName,
  type OwnedOrgSummary,
} from "@/lib/org-switcher-utils";
import { cn } from "@/lib/utils";

export type OrgSwitcherProps = {
  currentOrgId: string;
  currentOrgName: string;
  currentOrgType: string;
  currentLogoUrl?: string | null;
  ownedOrgs: OwnedOrgSummary[];
  onSwitch: (orgId: string) => void;
  switching?: boolean;
};

function OrgAvatar({
  logoUrl,
  accountType,
  size = "md",
}: {
  logoUrl?: string | null;
  accountType: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "size-6" : "size-7";
  const iconClass = size === "sm" ? "text-xs" : "text-sm";

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt=""
        className={cn(sizeClass, "shrink-0 rounded-full object-cover")}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "flex shrink-0 items-center justify-center rounded-full",
        getOrgTypeBadgeStyle(accountType),
      )}
    >
      <span className={iconClass}>{getOrgTypeIcon(accountType)}</span>
    </div>
  );
}

function OrgTriggerContent({
  currentOrgName,
  currentOrgType,
  currentLogoUrl,
  ownedOrgs,
  interactive,
}: {
  currentOrgName: string;
  currentOrgType: string;
  currentLogoUrl?: string | null;
  ownedOrgs: OwnedOrgSummary[];
  interactive: boolean;
}) {
  return (
    <>
      <OrgAvatar
        logoUrl={currentLogoUrl}
        accountType={currentOrgType}
        size="sm"
      />
      <span className="max-w-[140px] truncate text-sm font-semibold text-[var(--admin-ink)]">
        {currentOrgName}
      </span>
      {ownedOrgs.length > 1 && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium",
            getOrgTypeBadgeStyle(currentOrgType),
          )}
        >
          {getOrgTypeShortName(currentOrgType)}
        </span>
      )}
      {interactive && (
        <ChevronsUpDown className="size-3.5 shrink-0 text-text-tertiary" />
      )}
    </>
  );
}

export function OrgSwitcher({
  currentOrgId,
  currentOrgName,
  currentOrgType,
  currentLogoUrl,
  ownedOrgs,
  onSwitch,
  switching = false,
}: OrgSwitcherProps) {
  const router = useRouter();
  const hasMultiple = ownedOrgs.length > 1;

  const triggerClass = cn(
    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-border-light px-3 transition-colors",
    hasMultiple && "cursor-pointer hover:bg-content",
    switching && "pointer-events-none opacity-60",
  );

  if (!hasMultiple) {
    return (
      <div className={cn(triggerClass, "cursor-default bg-white")}>
        <OrgTriggerContent
          currentOrgName={currentOrgName}
          currentOrgType={currentOrgType}
          currentLogoUrl={currentLogoUrl}
          ownedOrgs={ownedOrgs}
          interactive={false}
        />
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger className={cn(triggerClass, "bg-white outline-none")}>
        <OrgTriggerContent
          currentOrgName={currentOrgName}
          currentOrgType={currentOrgType}
          currentLogoUrl={currentLogoUrl}
          ownedOrgs={ownedOrgs}
          interactive
        />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[280px] p-0">
        <Command className="w-[280px]">
          <CommandInput placeholder="搜索组织..." className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty>未找到相关组织</CommandEmpty>

            <CommandGroup heading="我的组织">
              {ownedOrgs.map((org) => {
                const isApproved = org.admin_status === "APPROVED";
                const isCurrent = org.id === currentOrgId;

                return (
                  <CommandItem
                    key={org.id}
                    value={`${org.name} ${org.slug} ${getOrgTypeFullName(org.account_type)}`}
                    onSelect={() => {
                      if (isApproved) onSwitch(org.id);
                    }}
                    disabled={!isApproved}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 px-3 py-2.5",
                      isCurrent && "bg-brand-blue-light",
                      !isApproved && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <OrgAvatar
                      logoUrl={org.logo_url}
                      accountType={org.account_type}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {org.name}
                        </span>
                        {isCurrent && (
                          <Check className="size-3.5 shrink-0 text-brand-blue" />
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[10px]",
                            getOrgTypeBadgeStyle(org.account_type),
                          )}
                        >
                          {getOrgTypeFullName(org.account_type)}
                        </span>
                        {!isApproved && (
                          <span className="text-[10px] text-brand-amber">
                            {org.admin_status === "PENDING_REVIEW"
                              ? "审核中"
                              : "已拒绝"}
                          </span>
                        )}
                      </div>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>

            <CommandSeparator />

            <CommandGroup>
              <CommandItem
                onSelect={() => router.push("/register/admin?mode=add")}
                className="flex cursor-pointer items-center gap-2 px-3 py-2 text-brand-blue"
              >
                <Plus className="size-4" />
                <span className="text-sm">申请新组织</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
