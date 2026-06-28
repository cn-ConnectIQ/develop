/** 规则匹配权重（可调，勿写死在 recall/rank 逻辑里） */
export type MatchingWeights = {
  /** 我的 demand ∩ 对方 supply（每个命中标签） */
  demandSupplyMatch: number;
  /** 我的 supply ∩ 对方 demand（每个命中标签） */
  supplyDemandMatch: number;
  /** 角色互补（采购↔销售等，命中一次） */
  roleComplement: number;
  /** 共同话题（每个命中话题） */
  sharedTopic: number;
  /** 同行业（命中一次） */
  sharedIndustry: number;
  /** 同场签到（双方均在活动签到） */
  coPresence: number;
  /** 行为信号（同场有互动/扫码信号，阶段一简化） */
  interactionSignal: number;
  /** 向量语义相近（命中一次，按相似度档位计分） */
  semanticSimilarity: number;
};

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  demandSupplyMatch: 25,
  supplyDemandMatch: 22,
  roleComplement: 18,
  sharedTopic: 10,
  sharedIndustry: 8,
  coPresence: 5,
  interactionSignal: 6,
  semanticSimilarity: 14,
};

export type RecallLimits = {
  min: number;
  max: number;
};

export const DEFAULT_RECALL_LIMITS: RecallLimits = {
  min: 30,
  max: 50,
};

/** 角色互补对（双向） */
export const ROLE_COMPLEMENT_PAIRS: ReadonlyArray<
  readonly [string, string]
> = [
  ["采购", "销售"],
  ["销售", "采购"],
  ["投资", "被投"],
  ["被投", "投资"],
  ["投资", "融资"],
  ["融资", "投资"],
];

export type RankOptions = {
  weights?: Partial<MatchingWeights>;
  signalWeights?: Partial<SignalRankWeights>;
  topN?: number;
  eventId?: string;
  /** 边界候选 LLM 语义互补判断（默认 true，需 LLM 已配置） */
  enableLlmComplement?: boolean;
  llmComplement?: Partial<LlmComplementConfig>;
};

/** 精排行为信号权重（在规则分之上加减） */
export type SignalRankWeights = {
  /** 同场都停留/扫码过同一展位 */
  sharedBoothVisit: number;
  /** 对方停留展位与 viewer 需求标签方向一致 */
  peerBoothAlignsDemand: number;
  /** 现场行为推断意向与彼此标签呼应 */
  viewerPeerIntentOverlap: number;
  /** 对方参与过互动（投票/问答/扫码互动） */
  peerInteractionActive: number;
  /** 双方均有现场行为信号 */
  bothOnSiteActive: number;
  /** 跨活动共同参会 */
  crossEventCoAttendance: number;
  /** 曾在其他活动建立连接 */
  crossEventPriorConnection: number;
  /** 对方现场低活跃（负向） */
  peerLowEngagement: number;
};

export const DEFAULT_SIGNAL_RANK_WEIGHTS: SignalRankWeights = {
  sharedBoothVisit: 6,
  peerBoothAlignsDemand: 8,
  viewerPeerIntentOverlap: 5,
  peerInteractionActive: 4,
  bothOnSiteActive: 3,
  crossEventCoAttendance: 4,
  crossEventPriorConnection: 6,
  peerLowEngagement: -3,
};

export type LlmComplementConfig = {
  /** 最多 LLM 判断人数 */
  maxChecks: number;
  /** 与 TopN  cutoff 的分差带 */
  scoreBand: number;
  /** cutoff 前额外纳入人数 */
  marginBefore: number;
  /** cutoff 后额外纳入人数 */
  marginAfter: number;
  /** LLM boost 上限 */
  maxBoost: number;
};

export const DEFAULT_LLM_COMPLEMENT_CONFIG: LlmComplementConfig = {
  maxChecks: 5,
  scoreBand: 10,
  marginBefore: 3,
  marginAfter: 7,
  maxBoost: 12,
};

export function mergeSignalRankWeights(
  overrides?: Partial<SignalRankWeights>,
): SignalRankWeights {
  return { ...DEFAULT_SIGNAL_RANK_WEIGHTS, ...overrides };
}

export function mergeLlmComplementConfig(
  overrides?: Partial<LlmComplementConfig>,
): LlmComplementConfig {
  return { ...DEFAULT_LLM_COMPLEMENT_CONFIG, ...overrides };
}

export const DEFAULT_RANK_TOP_N = 20;

/** 向量召回默认条数 */
export const DEFAULT_VECTOR_RECALL_LIMIT = 20;

/** 向量余弦相似度下限（低于此不入池） */
export const DEFAULT_VECTOR_MIN_SIMILARITY = 0.62;

export function mergeMatchingWeights(
  overrides?: Partial<MatchingWeights>,
): MatchingWeights {
  return { ...DEFAULT_MATCHING_WEIGHTS, ...overrides };
}
