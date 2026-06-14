import type { BigscreenDisplayConfig, QnaQuestion } from "@/lib/bigscreen-display";

export type BigscreenPoll = {
  id: string;
  title: string;
  type: string;
  status: string;
  showResults: boolean;
  closesAt: string | null;
  createdAt: string;
  responseCount: number;
};

export type PollOptionResult = {
  id: string;
  text: string;
  count: number;
  percentage: number;
};

export type WordCloudItem = { text: string; count: number };

export type BigscreenData = {
  livePoll: BigscreenPoll | null;
  display: BigscreenDisplayConfig | null;
  results: { total: number; options: PollOptionResult[] } | null;
  wordCloud: WordCloudItem[];
  qnaQuestions: QnaQuestion[];
  queue: {
    next: { id: string; title: string; type: string; scheduledAt: string | null } | null;
    drafts: Array<{ id: string; title: string; type: string; scheduledAt: string | null }>;
  };
  stats: {
    checkedIn: number;
    onSite: number;
    participants: number;
    participationRate: number;
  };
};
