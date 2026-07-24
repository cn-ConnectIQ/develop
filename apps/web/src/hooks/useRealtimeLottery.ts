"use client";

import { useCallback, useEffect, useRef } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  subscribeLotteryResult,
  type LotteryWinnerPayload,
} from "@/lib/realtime";
import { parsePrizes } from "@/lib/lottery-types";
import { withPublicPath } from "@/lib/public-path";
import { useBigscreenStore } from "@/stores/bigscreenStore";

type UseRealtimeLotteryOptions = {
  eventId: string;
  lotteryId: string | null;
  enabled?: boolean;
};

export function useRealtimeLottery({
  eventId,
  lotteryId,
  enabled = true,
}: UseRealtimeLotteryOptions) {
  const initLottery = useBigscreenStore((s) => s.initLottery);
  const setLotteryEntryCount = useBigscreenStore((s) => s.setLotteryEntryCount);
  const setLotteryQrUrl = useBigscreenStore((s) => s.setLotteryQrUrl);
  const setRollingEntries = useBigscreenStore((s) => s.setRollingEntries);
  const addWinners = useBigscreenStore((s) => s.addWinners);
  const setPrizeStatus = useBigscreenStore((s) => s.setPrizeStatus);
  const setMode = useBigscreenStore((s) => s.setMode);
  const setIsRollingSettled = useBigscreenStore((s) => s.setIsRollingSettled);
  const setCurrentWinner = useBigscreenStore((s) => s.setCurrentWinner);
  const setRollingPerson = useBigscreenStore((s) => s.setRollingPerson);

  const fetchLottery = useCallback(async () => {
    if (!lotteryId) return;
    try {
      const [lotteryRes, entriesRes, winnersRes, joinRes] = await Promise.all([
        fetch(withPublicPath(`/api/events/${eventId}/lotteries/${lotteryId}`)),
        fetch(
          withPublicPath(`/api/events/${eventId}/lotteries/${lotteryId}/entries`),
        ),
        fetch(
          withPublicPath(`/api/events/${eventId}/lotteries/${lotteryId}/winners`),
        ),
        fetch(
          withPublicPath(`/api/events/${eventId}/lotteries/${lotteryId}/join-qr`),
        ),
      ]);

      if (lotteryRes.ok) {
        const lottery = (await lotteryRes.json()).data;
        const prizes = parsePrizes(lottery.prizes);
        const quota = prizes.reduce((sum, p) => sum + (p.count ?? 1), 0);
        initLottery({
          lotteryId,
          title: lottery.title,
          entryCount: lottery.entryCount ?? lottery._count?.entries ?? 0,
          quota,
          qrUrl: lottery.qrUrl ?? null,
          prizes,
        });

        if (lottery.status === "DRAWING") {
          setMode("lottery_drawing");
        } else if (lottery.status === "FINISHED") {
          setMode("lottery_result");
        }
      }

      if (joinRes.ok) {
        const join = (await joinRes.json()).data as {
          wxacodeUrl?: string | null;
          qrUrl?: string | null;
        };
        const qr = join?.wxacodeUrl || join?.qrUrl || null;
        if (qr) setLotteryQrUrl(qr);
      }

      if (winnersRes.ok) {
        const winners = (await winnersRes.json()).data as Array<{
          prizeRank: number;
        }>;
        for (const w of winners) {
          setPrizeStatus(w.prizeRank, "done");
        }
      }

      if (entriesRes.ok) {
        const entries = (await entriesRes.json()).data as Array<{
          id: string;
          name: string;
          company?: string | null;
          jobTitle?: string | null;
        }>;
        setRollingEntries(entries);
        setLotteryEntryCount(entries.length);
      }
    } catch {
      /* ignore */
    }
  }, [
    eventId,
    lotteryId,
    initLottery,
    setLotteryEntryCount,
    setLotteryQrUrl,
    setRollingEntries,
    setMode,
    setPrizeStatus,
  ]);

  useEffect(() => {
    if (!enabled || !lotteryId) return;
    void fetchLottery();
  }, [enabled, lotteryId, fetchLottery]);

  const fetchRef = useRef(fetchLottery);
  fetchRef.current = fetchLottery;

  useEffect(() => {
    if (!enabled || !lotteryId || !eventId) return;

    const supabase = getSupabaseBrowserClient();

    const pollTimer = setInterval(() => void fetchRef.current(), 30_000);

    let unsubscribeBroadcast: (() => void) | null = null;
    unsubscribeBroadcast = subscribeLotteryResult(
      eventId,
      lotteryId,
      (winners: LotteryWinnerPayload[]) => {
        addWinners(
          winners.map((w) => ({
            id: w.id,
            name: w.name,
            company: w.company,
            prizeRank: w.prizeRank,
            prizeName: w.prizeName,
          })),
        );
        if (winners[0]) {
          setPrizeStatus(winners[0].prizeRank, "done");
          setCurrentWinner({
            id: winners[0].userId,
            name: winners[0].name,
            company: winners[0].company,
          });
          setRollingPerson({
            id: winners[0].userId,
            name: winners[0].name,
            company: winners[0].company,
          });
          setIsRollingSettled(true);
          setMode("lottery_drawing");
        }
      },
    );

    if (supabase) {
      const channel = supabase.channel(`lottery-entries-${eventId}-${lotteryId}`);
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lottery_entries",
          filter: `lottery_id=eq.${lotteryId}`,
        },
        () => void fetchRef.current(),
      );
      channel.subscribe();

      return () => {
        clearInterval(pollTimer);
        unsubscribeBroadcast?.();
        void supabase.removeChannel(channel);
      };
    }

    return () => {
      clearInterval(pollTimer);
      unsubscribeBroadcast?.();
    };
  }, [
    eventId,
    lotteryId,
    enabled,
    addWinners,
    setPrizeStatus,
    setCurrentWinner,
    setRollingPerson,
    setIsRollingSettled,
    setMode,
  ]);

  return { refetch: fetchLottery };
}
