import { create } from "zustand";
import type { QnaQuestion } from "@/lib/bigscreen-display";
import type { BigscreenPoll, PollOptionResult } from "@/lib/bigscreen-types";
import type { LotteryPrizeConfig } from "@/lib/interaction/schemas";
import type { RealtimePollResults } from "@/lib/interaction-manager";

export type BigscreenMode =
  | "idle"
  | "poll"
  | "qna"
  | "wordcloud"
  | "rating"
  | "lottery_waiting"
  | "lottery_drawing"
  | "lottery_result";

export type ProjectionTab = "interaction" | "booth_ranking" | "network_heat";

export type BoothRankingTopLimit = 5 | 10 | 15 | "all";

export type RollingPerson = {
  id: string;
  name: string;
  company?: string | null;
  jobTitle?: string | null;
};

export type LotteryWinnerDisplay = {
  id: string;
  name: string;
  company: string | null;
  prizeRank: number;
  prizeName: string;
};

export type PrizeDrawStatus = "pending" | "drawing" | "done";

type BigscreenStore = {
  eventId: string | null;
  eventName: string;
  joinQrUrl: string | null;
  currentMode: BigscreenMode;
  currentPoll: BigscreenPoll | null;
  pollResults: RealtimePollResults | null;
  showResults: boolean;
  lockVotes: boolean;
  featuredQna: QnaQuestion | null;
  currentLotteryId: string | null;
  lotteryTitle: string;
  lotteryEntryCount: number;
  lotteryQuota: number;
  lotteryQrUrl: string | null;
  lotteryPrizes: LotteryPrizeConfig[];
  prizeStatuses: Record<number, PrizeDrawStatus>;
  activePrizeRank: number | null;
  rollingPerson: RollingPerson | null;
  isRollingSettled: boolean;
  currentWinner: RollingPerson | null;
  allWinners: LotteryWinnerDisplay[];
  rollingEntries: RollingPerson[];
  isRollingPaused: boolean;
  queue: Array<{ id: string; title: string; type: string }>;
  stats: {
    onSite: number;
    participants: number;
    participationRate: number;
  };
  countdown: string;
  projectionTab: ProjectionTab;
  boothRankingAutoRefresh: boolean;
  boothRankingTopLimit: BoothRankingTopLimit;
  boothRankingHighlightGrowth: boolean;
  boothRankingRefreshNonce: number;

  setEvent: (eventId: string, eventName: string) => void;
  setJoinQrUrl: (url: string | null) => void;
  setMode: (mode: BigscreenMode) => void;
  setCurrentPoll: (poll: BigscreenPoll | null) => void;
  setPollResults: (results: RealtimePollResults | null) => void;
  setShowResults: (value: boolean) => void;
  setLockVotes: (value: boolean) => void;
  setFeaturedQna: (q: QnaQuestion | null) => void;
  setCountdown: (value: string) => void;
  setQueue: (items: Array<{ id: string; title: string; type: string }>) => void;
  setStats: (stats: BigscreenStore["stats"]) => void;
  initLottery: (payload: {
    lotteryId: string;
    title: string;
    entryCount: number;
    quota: number;
    qrUrl?: string | null;
    prizes: LotteryPrizeConfig[];
  }) => void;
  setLotteryEntryCount: (count: number) => void;
  setPrizeStatus: (rank: number, status: PrizeDrawStatus) => void;
  setActivePrizeRank: (rank: number | null) => void;
  setRollingPerson: (person: RollingPerson | null) => void;
  setRollingEntries: (entries: RollingPerson[]) => void;
  setIsRollingSettled: (value: boolean) => void;
  setCurrentWinner: (winner: RollingPerson | null) => void;
  addWinners: (winners: LotteryWinnerDisplay[]) => void;
  setIsRollingPaused: (value: boolean) => void;
  resetRolling: () => void;
  deriveModeFromPoll: (poll: BigscreenPoll | null) => void;
  setProjectionTab: (tab: ProjectionTab) => void;
  setBoothRankingAutoRefresh: (value: boolean) => void;
  setBoothRankingTopLimit: (limit: BoothRankingTopLimit) => void;
  setBoothRankingHighlightGrowth: (value: boolean) => void;
  bumpBoothRankingRefresh: () => void;
};

export const useBigscreenStore = create<BigscreenStore>((set, get) => ({
  eventId: null,
  eventName: "活动",
  joinQrUrl: null,
  currentMode: "idle",
  currentPoll: null,
  pollResults: null,
  showResults: true,
  lockVotes: false,
  featuredQna: null,
  currentLotteryId: null,
  lotteryTitle: "",
  lotteryEntryCount: 0,
  lotteryQuota: 0,
  lotteryQrUrl: null,
  lotteryPrizes: [],
  prizeStatuses: {},
  activePrizeRank: null,
  rollingPerson: null,
  isRollingSettled: false,
  currentWinner: null,
  allWinners: [],
  rollingEntries: [],
  isRollingPaused: false,
  queue: [],
  stats: { onSite: 0, participants: 0, participationRate: 0 },
  countdown: "--:--",
  projectionTab: "interaction",
  boothRankingAutoRefresh: true,
  boothRankingTopLimit: 10,
  boothRankingHighlightGrowth: false,
  boothRankingRefreshNonce: 0,

  setEvent: (eventId, eventName) => set({ eventId, eventName }),
  setJoinQrUrl: (url) => set({ joinQrUrl: url }),
  setMode: (mode) => set({ currentMode: mode }),
  setCurrentPoll: (poll) => set({ currentPoll: poll }),
  setPollResults: (results) => set({ pollResults: results }),
  setShowResults: (value) => set({ showResults: value }),
  setLockVotes: (value) => set({ lockVotes: value }),
  setFeaturedQna: (q) => set({ featuredQna: q }),
  setCountdown: (value) => set({ countdown: value }),
  setQueue: (items) => set({ queue: items }),
  setStats: (stats) => set({ stats }),

  initLottery: ({ lotteryId, title, entryCount, quota, qrUrl, prizes }) => {
    const prizeStatuses: Record<number, PrizeDrawStatus> = {};
    for (const p of prizes) {
      prizeStatuses[p.rank] = "pending";
    }
    set({
      currentLotteryId: lotteryId,
      lotteryTitle: title,
      lotteryEntryCount: entryCount,
      lotteryQuota: quota,
      lotteryQrUrl: qrUrl ?? null,
      lotteryPrizes: prizes,
      prizeStatuses,
      currentMode: "lottery_waiting",
    });
  },

  setLotteryEntryCount: (count) => set({ lotteryEntryCount: count }),

  setPrizeStatus: (rank, status) =>
    set((s) => ({
      prizeStatuses: { ...s.prizeStatuses, [rank]: status },
    })),

  setActivePrizeRank: (rank) => set({ activePrizeRank: rank }),
  setRollingPerson: (person) => set({ rollingPerson: person }),
  setRollingEntries: (entries) => set({ rollingEntries: entries }),
  setIsRollingSettled: (value) => set({ isRollingSettled: value }),
  setCurrentWinner: (winner) => set({ currentWinner: winner }),
  addWinners: (winners) =>
    set((s) => ({ allWinners: [...s.allWinners, ...winners] })),
  setIsRollingPaused: (value) => set({ isRollingPaused: value }),

  resetRolling: () =>
    set({
      rollingPerson: null,
      isRollingSettled: false,
      currentWinner: null,
      isRollingPaused: false,
    }),

  deriveModeFromPoll: (poll) => {
    if (get().currentLotteryId && get().currentMode.startsWith("lottery")) {
      return;
    }
    if (!poll) {
      set({ currentMode: "idle", currentPoll: null });
      return;
    }
    set({ currentPoll: poll });
    switch (poll.type) {
      case "QNA":
        set({ currentMode: "qna" });
        break;
      case "WORD_CLOUD":
        set({ currentMode: "wordcloud" });
        break;
      case "RATING":
        set({ currentMode: "rating" });
        break;
      default:
        set({ currentMode: "poll" });
    }
  },

  setProjectionTab: (tab) => set({ projectionTab: tab }),
  setBoothRankingAutoRefresh: (value) => set({ boothRankingAutoRefresh: value }),
  setBoothRankingTopLimit: (limit) => set({ boothRankingTopLimit: limit }),
  setBoothRankingHighlightGrowth: (value) =>
    set({ boothRankingHighlightGrowth: value }),
  bumpBoothRankingRefresh: () =>
    set((s) => ({ boothRankingRefreshNonce: s.boothRankingRefreshNonce + 1 })),
}));

export function getMaxPercentage(options: PollOptionResult[]) {
  if (!options.length) return 0;
  return Math.max(...options.map((o) => o.percentage));
}
