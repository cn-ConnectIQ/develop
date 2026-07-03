"use client";

import { Trophy } from "lucide-react";
import { MobileDevicePreview } from "@/components/admin/mobile-device-preview";
import { Button } from "@/components/ui/button";
import { LeadFormRenderer } from "@/components/lead-form/LeadFormRenderer";
import type { LeadFormField } from "@/lib/lead-form/types";
import { prizeRankLabel } from "@/lib/lottery-types";
import { tierMedal } from "@/lib/lottery/organizer-lottery-config";
import { cn } from "@/lib/utils";

type PrizePreview = {
  name: string;
  quantity: number;
  image_url?: string | null;
  tier?: number;
};

type BoothLotteryPreviewProps = {
  companyName?: string;
  eventName?: string;
  title: string;
  description?: string;
  prizes: PrizePreview[];
  submitLabel?: string;
  requireLeadCapture?: boolean;
  leadFields?: LeadFormField[];
  dark?: boolean;
};

export function BoothLotteryPreview({
  companyName,
  eventName,
  title,
  description,
  prizes,
  submitLabel = "立即抽奖",
  requireLeadCapture,
  leadFields = [],
  dark,
}: BoothLotteryPreviewProps) {
  const sorted = [...prizes].sort(
    (a, b) => (a.tier ?? 99) - (b.tier ?? 99),
  );

  return (
    <MobileDevicePreview width={280} dark={dark}>
      <div className="space-y-5">
        {(companyName || eventName) && (
          <p
            className={cn(
              "text-center text-xs",
              dark ? "text-white/40" : "text-text-muted",
            )}
          >
            {companyName ?? eventName}
          </p>
        )}

        <div className="text-center">
          <h2
            className={cn(
              "text-xl font-semibold leading-snug",
              dark && "text-white",
            )}
          >
            {title || "抽奖名称"}
          </h2>
          {description ? (
            <p
              className={cn(
                "mt-1 text-sm",
                dark ? "text-white/50" : "text-text-muted",
              )}
            >
              {description}
            </p>
          ) : null}
        </div>

        <ul className="space-y-2.5">
          {sorted.map((prize, index) => (
            <li
              key={`${prize.name}-${index}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                dark
                  ? "border-white/10 bg-white/5"
                  : "border-border-light bg-white",
              )}
            >
              {prize.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={prize.image_url}
                  alt=""
                  className="size-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div
                  className={cn(
                    "flex size-12 shrink-0 items-center justify-center rounded-lg",
                    dark ? "bg-white/10" : "bg-brand-gold/15",
                  )}
                >
                  {prize.tier != null ? (
                    <span className="text-xl">{tierMedal(prize.tier)}</span>
                  ) : (
                    <Trophy
                      className={cn(
                        "size-5",
                        dark ? "text-brand-gold" : "text-brand-gold",
                      )}
                    />
                  )}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    "truncate text-sm font-medium",
                    dark && "text-white",
                  )}
                >
                  {prize.name || prizeRankLabel(index + 1)}
                </p>
                <p
                  className={cn(
                    "text-xs",
                    dark ? "text-white/45" : "text-text-muted",
                  )}
                >
                  × {prize.quantity}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {requireLeadCapture && leadFields.length > 0 ? (
          <LeadFormRenderer
            fields={leadFields}
            title="填写信息参与抽奖"
            submitLabel={submitLabel}
            user={{
              name: "张三",
              phone: "138****8888",
              company: "示例科技",
              title: "采购经理",
            }}
            onSubmit={() => undefined}
          />
        ) : (
          <Button
            className={cn(
              "w-full",
              dark
                ? "bg-brand-gold text-white hover:bg-brand-gold/90"
                : "bg-brand-blue hover:bg-brand-blue/90",
            )}
          >
            {submitLabel}
          </Button>
        )}
      </div>
    </MobileDevicePreview>
  );
}
