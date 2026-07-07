"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ReelOfHonor, buildReelColumns, resolveReelFinalIndices, DEFAULT_REEL_STOP_SEQUENCE } from "@/components/screen/lottery-animations/ReelOfHonor";
import { StarlightOrbit, resolveOrbitWinnerIndex } from "@/components/screen/lottery-animations/StarlightOrbit";
import { PrecisionRoller, buildPrecisionRollerConfig } from "@/components/screen/lottery-animations/PrecisionRoller";
import { ScrollUnveiling, calcScrollUnveilingDuration } from "@/components/screen/lottery-animations/ScrollUnveiling";
import { WinnerGridReveal } from "@/components/screen/lottery-animations/WinnerGridReveal";
import { RollingMachine } from "@/components/screen/lottery-animations/RollingMachine";
import { SpotlightScroll } from "@/components/screen/lottery-animations/SpotlightScroll";
import { BigScreenAnimationType } from "@/lib/lottery/big-screen-animation-config";
import type {
  LotteryAnimationPhase,
  LotteryAnimationProps,
  ReelColumnEntry,
  ReelWinnerInfo,
} from "@/components/screen/lottery-animations/types";
import type { BigScreenAnimationTypeValue } from "@/lib/lottery/big-screen-animation-config";
import {
  subscribeLotteryScreen,
  type LotteryScreenBroadcast,
  type LotteryScreenRollingEntry,
  type LotteryScreenWinnerPayload,
} from "@/lib/realtime/lottery-screen";

type ScreenPhase = "idle" | "animating" | "revealed" | "ended";

export type LotteryScreenAnimationState = {
  screenPhase: ScreenPhase;
  animationType: BigScreenAnimationTypeValue;
  animationProps: LotteryAnimationProps | null;
  title: string;
  entryCount: number;
  winners: LotteryScreenWinnerPayload[];
  progress: { revealed: number; quota: number };
  loading: boolean;
  error: string | null;
  dispatchExtras: LotteryDispatchExtras;
};

export type LotteryDispatchExtras = {
  reelColumns: ReturnType<typeof buildReelColumns>;
  reelFinalIndices: ReturnType<typeof resolveReelFinalIndices>;
  orbitWinnerIndex: number;
  rollerConfig: ReturnType<typeof buildPrecisionRollerConfig>;
  resolvedWinner: ReelWinnerInfo | null;
  pendingWinner: LotteryScreenWinnerPayload | null;
  currentWinner: LotteryScreenWinnerPayload | null;
};

function toReelWinner(
  winner: LotteryScreenWinnerPayload | null,
): ReelWinnerInfo | null {
  if (!winner) return null;
  return {
    name: winner.name,
    company: winner.company,
    prize_name: winner.prize_name,
    prize_rank: winner.prize_rank,
    verification_code: winner.verification_code,
    pickup_note: winner.pickup_note,
  };
}

function toRollingEntries(
  entries: LotteryScreenRollingEntry[],
): ReelColumnEntry[] {
  return entries.map((e) => ({
    id: e.id,
    name: e.name,
    company: e.company,
  }));
}

async function fetchLotteryAnimationType(
  eventId: string,
  lotteryId: string,
): Promise<BigScreenAnimationTypeValue> {
  const res = await fetch(
    `/api/events/${eventId}/lotteries/${lotteryId}/screen-state`,
  );
  if (!res.ok) throw new Error("加载抽奖配置失败");
  const json = await res.json();
  const raw = json.data?.lottery?.big_screen_animation_type as
    | BigScreenAnimationTypeValue
    | undefined;
  return raw ?? BigScreenAnimationType.ROLLING_MACHINE;
}

export function useLotteryScreenAnimation(
  eventId: string,
  lotteryId: string,
): LotteryScreenAnimationState {
  const [screenPhase, setScreenPhase] = useState<ScreenPhase>("idle");
  const [animationType, setAnimationType] =
    useState<BigScreenAnimationTypeValue>(
      BigScreenAnimationType.ROLLING_MACHINE,
    );
  const [title, setTitle] = useState("闭幕全场大抽奖");
  const [entryCount, setEntryCount] = useState(0);
  const [rollingEntries, setRollingEntries] = useState<
    LotteryScreenRollingEntry[]
  >([]);
  const [currentWinners, setCurrentWinners] = useState<
    LotteryScreenWinnerPayload[]
  >([]);
  const [currentWinner, setCurrentWinner] =
    useState<LotteryScreenWinnerPayload | null>(null);
  const [winners, setWinners] = useState<LotteryScreenWinnerPayload[]>([]);
  const [progress, setProgress] = useState({ revealed: 0, quota: 0 });
  const [tierLabel, setTierLabel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [animPhase, setAnimPhase] = useState<LotteryAnimationPhase>("spinning");
  const [stoppedIndexes, setStoppedIndexes] = useState<number[]>([]);
  const [pendingWinners, setPendingWinners] = useState<
    LotteryScreenWinnerPayload[]
  >([]);
  const [pendingWinner, setPendingWinner] =
    useState<LotteryScreenWinnerPayload | null>(null);

  const animationTypeRef = useRef(animationType);
  const entryNamesRef = useRef<string[]>([]);
  const reelStopTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const orbitStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rollerStopTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scrollStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const genericStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    animationTypeRef.current = animationType;
  }, [animationType]);

  const entryNames = useMemo(
    () => rollingEntries.map((e) => e.name),
    [rollingEntries],
  );

  useEffect(() => {
    entryNamesRef.current = entryNames;
  }, [entryNames]);

  function clearReelStopTimers() {
    reelStopTimers.current.forEach(clearTimeout);
    reelStopTimers.current = [];
  }

  function clearOrbitStopTimer() {
    if (orbitStopTimer.current) clearTimeout(orbitStopTimer.current);
    orbitStopTimer.current = null;
  }

  function clearRollerStopTimers() {
    rollerStopTimers.current.forEach(clearTimeout);
    rollerStopTimers.current = [];
  }

  function clearScrollStopTimer() {
    if (scrollStopTimer.current) clearTimeout(scrollStopTimer.current);
    scrollStopTimer.current = null;
  }

  function clearGenericStopTimer() {
    if (genericStopTimer.current) clearTimeout(genericStopTimer.current);
    genericStopTimer.current = null;
  }

  function resetAnimState() {
    clearReelStopTimers();
    clearOrbitStopTimer();
    clearRollerStopTimers();
    clearScrollStopTimer();
    clearGenericStopTimer();
    setAnimPhase("spinning");
    setStoppedIndexes([]);
    setPendingWinner(null);
    setPendingWinners([]);
    setCurrentWinners([]);
  }

  function beginGenericStopping(
    winner: LotteryScreenWinnerPayload,
    durationMs: number,
  ) {
    clearGenericStopTimer();
    setPendingWinner(winner);
    setAnimPhase("stopping");
    genericStopTimer.current = setTimeout(() => {
      setAnimPhase("revealed");
      setScreenPhase("revealed");
    }, durationMs);
  }

  function beginReelStopping(winner: LotteryScreenWinnerPayload) {
    clearReelStopTimers();
    setPendingWinner(winner);
    setAnimPhase("stopping");
    setStoppedIndexes([]);

    DEFAULT_REEL_STOP_SEQUENCE.forEach((colIndex, order) => {
      const timer = setTimeout(() => {
        setStoppedIndexes((prev) => [...prev, colIndex]);
        if (order === DEFAULT_REEL_STOP_SEQUENCE.length - 1) {
          const revealTimer = setTimeout(() => {
            setAnimPhase("revealed");
            setScreenPhase("revealed");
          }, 900);
          reelStopTimers.current.push(revealTimer);
        }
      }, 450 + order * 950);
      reelStopTimers.current.push(timer);
    });
  }

  function beginOrbitStopping(winner: LotteryScreenWinnerPayload) {
    clearOrbitStopTimer();
    setPendingWinner(winner);
    setAnimPhase("stopping");
    orbitStopTimer.current = setTimeout(() => {
      setAnimPhase("revealed");
      setScreenPhase("revealed");
    }, 3600);
  }

  function beginRollerStopping(winner: LotteryScreenWinnerPayload) {
    clearRollerStopTimers();
    setPendingWinner(winner);
    setAnimPhase("stopping");
    setStoppedIndexes([]);

    const { stopSequence } = buildPrecisionRollerConfig(
      entryNamesRef.current,
      winner.name,
    );

    stopSequence.forEach((rollerIndex, order) => {
      const timer = setTimeout(() => {
        setStoppedIndexes((prev) => [...prev, rollerIndex]);
        if (order === stopSequence.length - 1) {
          const revealTimer = setTimeout(() => {
            setAnimPhase("revealed");
            setScreenPhase("revealed");
          }, 900);
          rollerStopTimers.current.push(revealTimer);
        }
      }, 420 + order * 720);
      rollerStopTimers.current.push(timer);
    });
  }

  function beginScrollStopping(winner: LotteryScreenWinnerPayload) {
    clearScrollStopTimer();
    setPendingWinner(winner);
    setAnimPhase("stopping");
    const duration = calcScrollUnveilingDuration(winner.name, winner.company);
    scrollStopTimer.current = setTimeout(() => {
      setAnimPhase("revealed");
      setScreenPhase("revealed");
    }, duration);
  }

  function beginStoppingForWinners(
    type: BigScreenAnimationTypeValue,
    batch: LotteryScreenWinnerPayload[],
  ) {
    if (batch.length === 0) return;
    setPendingWinners(batch);
    setPendingWinner(batch[0] ?? null);
    if (batch.length > 1) {
      setScreenPhase("animating");
      setAnimPhase("stopping");
      clearGenericStopTimer();
      genericStopTimer.current = setTimeout(() => {
        setAnimPhase("revealed");
        setScreenPhase("revealed");
      }, 1400);
      return;
    }
    beginStoppingForType(type, batch[0]!);
  }

  function beginStoppingForType(
    type: BigScreenAnimationTypeValue,
    winner: LotteryScreenWinnerPayload,
  ) {
    setScreenPhase("animating");
    switch (type) {
      case BigScreenAnimationType.REEL_OF_HONOR:
        beginReelStopping(winner);
        break;
      case BigScreenAnimationType.STARLIGHT_ORBIT:
        beginOrbitStopping(winner);
        break;
      case BigScreenAnimationType.PRECISION_ROLLER:
        beginRollerStopping(winner);
        break;
      case BigScreenAnimationType.SCROLL_UNVEILING:
        beginScrollStopping(winner);
        break;
      case BigScreenAnimationType.ROLLING_MACHINE:
        beginGenericStopping(winner, 900);
        break;
      case BigScreenAnimationType.SPOTLIGHT_SCROLL:
        beginGenericStopping(winner, 2800);
        break;
      default:
        setAnimPhase("revealed");
        setScreenPhase("revealed");
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchLotteryAnimationType(eventId, lotteryId)
      .then((type) => {
        if (!cancelled) {
          setAnimationType(type);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, lotteryId]);

  useEffect(() => {
    const unsub = subscribeLotteryScreen(eventId, (msg: LotteryScreenBroadcast) => {
      if ("lottery_id" in msg.data && msg.data.lottery_id !== lotteryId) {
        return;
      }

      if (msg.type === "START_ANIMATION") {
        setTitle(msg.data.title);
        setEntryCount(msg.data.entry_count);
        setRollingEntries(msg.data.rolling_entries);
        setCurrentWinner(null);
        setCurrentWinners([]);
        setTierLabel(null);
        resetAnimState();
        setScreenPhase("animating");
      }

      if (msg.type === "TIER_START") {
        setTierLabel(msg.data.tier_label);
        resetAnimState();
        setScreenPhase("animating");
      }

      if (msg.type === "REVEAL_WINNER") {
        setCurrentWinner(msg.data.winner);
        setCurrentWinners([msg.data.winner]);
        setWinners((prev) => [...prev, msg.data.winner]);
        setProgress({
          revealed: msg.data.revealed_total,
          quota: msg.data.winner_quota,
        });
        beginStoppingForWinners(animationTypeRef.current, [msg.data.winner]);
      }

      if (msg.type === "REVEAL_TIER") {
        setCurrentWinners(msg.data.winners);
        setCurrentWinner(msg.data.winners[0] ?? null);
        setWinners((prev) => [...prev, ...msg.data.winners]);
        setProgress({
          revealed: msg.data.revealed_total,
          quota: msg.data.winner_quota,
        });
        setTierLabel(msg.data.tier_label);
        beginStoppingForWinners(animationTypeRef.current, msg.data.winners);
      }

      if (msg.type === "END") {
        setScreenPhase("ended");
      }
    });

    return () => {
      unsub?.();
      resetAnimState();
    };
  }, [eventId, lotteryId]);

  const batchWinners = useMemo(() => {
    const source =
      currentWinners.length > 0
        ? currentWinners
        : pendingWinners.length > 0
          ? pendingWinners
          : currentWinner
            ? [currentWinner]
            : pendingWinner
              ? [pendingWinner]
              : [];
    return source.map((w) => toReelWinner(w)).filter((w): w is ReelWinnerInfo => w != null);
  }, [currentWinners, pendingWinners, currentWinner, pendingWinner]);

  const resolvedWinner = batchWinners[0] ?? null;
  const displayAnimPhase: LotteryAnimationPhase =
    screenPhase === "revealed" ? "revealed" : animPhase;

  const reelColumns = buildReelColumns(toRollingEntries(rollingEntries));
  const winnerUserId =
    pendingWinner?.user_id ??
    currentWinner?.user_id ??
    rollingEntries[0]?.id ??
    "";
  const reelFinalIndices = resolveReelFinalIndices(
    toRollingEntries(rollingEntries),
    winnerUserId,
  );
  const orbitWinnerIndex = resolveOrbitWinnerIndex(
    toRollingEntries(rollingEntries),
    winnerUserId,
  );
  const rollerConfig = buildPrecisionRollerConfig(
    entryNames,
    pendingWinner?.name ?? currentWinner?.name ?? "····",
  );

  const showWinner =
    displayAnimPhase === "revealed" ||
    displayAnimPhase === "stopping";

  const animationProps: LotteryAnimationProps | null =
    screenPhase === "animating" || screenPhase === "revealed"
      ? {
          phase: displayAnimPhase,
          winners: showWinner ? batchWinners : [],
          winner: showWinner ? resolvedWinner : null,
          stopSequence: DEFAULT_REEL_STOP_SEQUENCE,
          stoppedIndexes,
          title,
          tierLabel,
          entryCount,
          rollingEntries: toRollingEntries(rollingEntries),
        }
      : null;

  const dispatchExtras: LotteryDispatchExtras = {
    reelColumns,
    reelFinalIndices,
    orbitWinnerIndex,
    rollerConfig,
    resolvedWinner,
    pendingWinner,
    currentWinner,
  };

  return {
    screenPhase,
    animationType,
    animationProps,
    title,
    entryCount,
    winners,
    progress,
    loading,
    error,
    dispatchExtras,
  };
}

export function LotteryAnimationDispatch({
  animationType,
  props,
  extras,
}: {
  animationType: BigScreenAnimationTypeValue;
  props: LotteryAnimationProps;
  extras: LotteryDispatchExtras;
}) {
  const isMultiReveal =
    props.phase === "revealed" && props.winners.length > 1;

  if (isMultiReveal) {
    return (
      <WinnerGridReveal
        winners={props.winners}
        tierLabel={props.tierLabel}
        prizeName={props.winners[0]?.prize_name}
      />
    );
  }

  const winnerForCard =
    props.phase === "revealed" ? extras.resolvedWinner : props.winner;
  const singleProps = { ...props, winner: winnerForCard };

  switch (animationType) {
    case BigScreenAnimationType.ROLLING_MACHINE:
      return <RollingMachine {...singleProps} winner={winnerForCard} />;

    case BigScreenAnimationType.SPOTLIGHT_SCROLL:
      return <SpotlightScroll {...singleProps} winner={winnerForCard} />;

    case BigScreenAnimationType.REEL_OF_HONOR:
      return (
        <ReelOfHonor
          phase={singleProps.phase}
          columns={extras.reelColumns}
          finalIndices={extras.reelFinalIndices}
          stopSequence={singleProps.stopSequence ?? DEFAULT_REEL_STOP_SEQUENCE}
          stoppedColumns={singleProps.stoppedIndexes}
          winner={winnerForCard}
          tierLabel={singleProps.tierLabel}
        />
      );

    case BigScreenAnimationType.STARLIGHT_ORBIT:
      return (
        <StarlightOrbit
          phase={singleProps.phase}
          entries={singleProps.rollingEntries}
          winnerIndex={extras.orbitWinnerIndex}
          winner={winnerForCard}
          tierLabel={singleProps.tierLabel}
        />
      );

    case BigScreenAnimationType.PRECISION_ROLLER:
      return (
        <PrecisionRoller
          phase={singleProps.phase}
          entryNames={singleProps.rollingEntries.map((e) => e.name)}
          targetName={
            extras.pendingWinner?.name ?? extras.currentWinner?.name ?? ""
          }
          charsets={extras.rollerConfig.charsets}
          finalIndices={extras.rollerConfig.finalIndices}
          stopSequence={extras.rollerConfig.stopSequence}
          stoppedRollers={singleProps.stoppedIndexes}
          winner={winnerForCard}
          tierLabel={singleProps.tierLabel}
        />
      );

    case BigScreenAnimationType.SCROLL_UNVEILING:
      return (
        <ScrollUnveiling
          phase={singleProps.phase}
          heading={singleProps.title}
          revealName={
            extras.pendingWinner?.name ?? extras.currentWinner?.name ?? ""
          }
          revealCompany={
            extras.pendingWinner?.company ??
            extras.currentWinner?.company ??
            null
          }
          winner={winnerForCard}
          tierLabel={singleProps.tierLabel}
        />
      );

    default:
      return <RollingMachine {...singleProps} winner={winnerForCard} />;
  }
}
