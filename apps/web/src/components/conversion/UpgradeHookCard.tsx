"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  buildHookCopy,
  CONVERSION_CTA_LABEL,
  CONVERSION_LEARN_URL,
  type ConversionHookContext,
  type ConversionHookTrigger,
  type ConversionHookVars,
  type ConversionTarget,
} from "@/lib/conversion-hook-config";
import { cn } from "@/lib/utils";

export type UpgradeHookCardProps = {
  target: ConversionTarget;
  context: ConversionHookContext;
  trigger: ConversionHookTrigger;
  eventId?: string;
  boothId?: string;
  forceShow?: boolean;
  vars?: ConversionHookVars;
  className?: string;
};

async function fetchEligibility(props: UpgradeHookCardProps) {
  const params = new URLSearchParams({
    target: props.target,
    context: props.context,
    trigger: props.trigger,
  });
  if (props.eventId) params.set("eventId", props.eventId);
  if (props.boothId) params.set("boothId", props.boothId);

  const res = await fetch(`/api/conversion/eligibility?${params.toString()}`);
  if (!res.ok) return { show: false, vars: {} as ConversionHookVars };
  return (await res.json()).data as {
    show: boolean;
    vars: ConversionHookVars;
  };
}

async function trackHook(
  props: UpgradeHookCardProps,
  action: "shown" | "clicked" | "dismissed",
  metadata?: Record<string, unknown>,
) {
  await fetch("/api/conversion/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      target: props.target,
      context: props.context,
      trigger: props.trigger,
      action,
      eventId: props.eventId,
      boothId: props.boothId,
      metadata,
    }),
  });
}

export function UpgradeHookCard(props: UpgradeHookCardProps) {
  const { target, context, className, forceShow, vars: varsOverride } = props;
  const [visible, setVisible] = useState(false);
  const [vars, setVars] = useState<ConversionHookVars>(varsOverride ?? {});
  const trackedShow = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (forceShow) {
        if (!cancelled) {
          setVars(varsOverride ?? {});
          setVisible(true);
        }
        return;
      }

      const result = await fetchEligibility(props);
      if (cancelled) return;
      if (result.show) {
        setVars({ ...result.vars, ...varsOverride });
        setVisible(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    forceShow,
    props.target,
    props.context,
    props.trigger,
    props.eventId,
    props.boothId,
    varsOverride,
  ]);

  useEffect(() => {
    if (!visible || trackedShow.current) return;
    trackedShow.current = true;
    void trackHook(props, "shown", vars);
  }, [visible, props, vars]);

  if (!visible) return null;

  const copy = buildHookCopy(target, context, vars);
  const href = CONVERSION_LEARN_URL[target];
  const isExternal = href.startsWith("http");

  function handleDismiss() {
    setVisible(false);
    void trackHook(props, "dismissed");
  }

  function handleClick() {
    void trackHook(props, "clicked", vars);
  }

  const accent =
    target === "BAGEVENT"
      ? "border-brand-blue/25 bg-brand-blue-light/40"
      : "border-brand-purple/25 bg-brand-purple/5";

  return (
    <div
      className={cn(
        "relative rounded-xl border px-4 py-4 pr-10",
        accent,
        className,
      )}
    >
      <button
        type="button"
        aria-label="关闭"
        className="absolute top-3 right-3 rounded-md p-1 text-text-muted hover:bg-white/60 hover:text-[var(--admin-ink)]"
        onClick={handleDismiss}
      >
        <X className="size-4" />
      </button>
      <p className="text-sm font-semibold text-[var(--admin-ink)]">{copy.title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-text-muted">{copy.body}</p>
      {isExternal ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-8 items-center rounded-lg bg-brand-blue px-3 text-xs font-medium text-white hover:bg-brand-blue/90"
          onClick={handleClick}
        >
          {CONVERSION_CTA_LABEL[target]}
        </a>
      ) : (
        <Link
          href={href}
          className="mt-3 inline-flex h-8 items-center rounded-lg bg-brand-purple px-3 text-xs font-medium text-white hover:bg-brand-purple/90"
          onClick={handleClick}
        >
          {CONVERSION_CTA_LABEL[target]}
        </Link>
      )}
    </div>
  );
}
