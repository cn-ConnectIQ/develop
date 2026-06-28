import type { MatchReasonItem } from "@/lib/matchmaking-config";

/** 匹配维度（召回命中 + 打分依据） */
export type MatchDimension =
  | "demand_supply"
  | "supply_demand"
  | "role_complement"
  | "shared_topic"
  | "shared_industry"
  | "co_presence"
  | "interaction"
  | "semantic_similarity";

export type MatchDimensionHit = {
  dimension: MatchDimension;
  label: string;
  detail?: string;
};

export type RecallCandidate = {
  userId: string;
  name: string;
  company: string | null;
  role: string | null;
  industry: string | null;
  region: string | null;
  supplyTags: string[];
  demandTags: string[];
  topics: string[];
  dimensions: MatchDimensionHit[];
  /** 召回阶段预排序：命中维度数 / 语义相似度加权 */
  recallScore: number;
  /** 向量召回相似度（0~1），仅 semantic 召回时有值 */
  semanticSimilarity?: number;
};

export type RankedCandidate = RecallCandidate & {
  score: number;
  matchReasons: MatchReasonItem[];
};

export type ViewerIntentProfile = {
  userId: string;
  role: string | null;
  industry: string | null;
  region: string | null;
  supplyTags: string[];
  demandTags: string[];
  topics: string[];
  checkedIn: boolean;
  signalUserIds: Set<string>;
};

export type PeerIntentProfile = {
  userId: string;
  name: string;
  company: string | null;
  role: string | null;
  industry: string | null;
  region: string | null;
  supplyTags: string[];
  demandTags: string[];
  topics: string[];
  checkedIn: boolean;
  hasSignals: boolean;
};
