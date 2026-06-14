"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { cn } from "@/lib/utils";

type ExhibitorOption = {
  id: string;
  name: string;
  email?: string | null;
};

type ExhibitorComboboxProps = {
  exhibitors: ExhibitorOption[];
  value: string;
  onChange: (exhibitorId: string) => void;
  disabled?: boolean;
};

export function ExhibitorCombobox({
  exhibitors,
  value,
  onChange,
  disabled,
}: ExhibitorComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = exhibitors.find((e) => e.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "mt-1 flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs",
          disabled && "cursor-not-allowed opacity-50",
        )}
        disabled={disabled}
      >
        <span className="truncate">
          {selected?.name ?? "选择展商…"}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索展商…" />
          <CommandList>
            <CommandEmpty>未找到展商</CommandEmpty>
            <CommandGroup>
              {exhibitors.map((exhibitor) => (
                <CommandItem
                  key={exhibitor.id}
                  value={`${exhibitor.name} ${exhibitor.email ?? ""}`}
                  onSelect={() => {
                    onChange(exhibitor.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === exhibitor.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm">{exhibitor.name}</p>
                    {exhibitor.email && (
                      <p className="truncate text-xs text-text-muted">
                        {exhibitor.email}
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
  );
}
