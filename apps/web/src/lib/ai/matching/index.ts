export {
  DEFAULT_MATCHING_WEIGHTS,
  DEFAULT_RANK_TOP_N,
  DEFAULT_RECALL_LIMITS,
  DEFAULT_SIGNAL_RANK_WEIGHTS,
  DEFAULT_LLM_COMPLEMENT_CONFIG,
  DEFAULT_VECTOR_MIN_SIMILARITY,
  DEFAULT_VECTOR_RECALL_LIMIT,
  ROLE_COMPLEMENT_PAIRS,
  mergeMatchingWeights,
  mergeSignalRankWeights,
  mergeLlmComplementConfig,
  type MatchingWeights,
  type RankOptions,
  type RecallLimits,
  type SignalRankWeights,
  type LlmComplementConfig,
} from "./config";

export {
  recallCandidates,
  buildDimensionHits,
  loadViewerProfile,
  loadExcludedUserIds,
  vectorRecall,
  type RecallOptions,
  type VectorRecallOptions,
} from "./recall";

export {
  rankCandidates,
  formatRankedReason,
  recallAndRank,
} from "./rank";

export { matchPair } from "./pair-match";

export {
  recordMatchFeedback,
  trackMatchFeedback,
  resolveMatchSnapshot,
  submitMatchFeedbackFromClient,
  FEEDBACK_SIGNAL_OUTCOME_SCORE,
  type RecordMatchFeedbackInput,
  type SubmitMatchFeedbackBody,
} from "./match-feedback-service";

export {
  analyzeMatchFeedbackWeights,
  runOfflineMatchWeightTuning,
  loadFeedbackTunedWeights,
  getEffectiveMatchingWeights,
  type DimensionAdoptionStat,
  type FeedbackWeightAnalysis,
} from "./match-feedback-analysis";

export {
  extractRealtimeTopics,
  mergeStaticIntentTopics,
  topicMatchesText,
  REALTIME_SIGNAL_WINDOW_MS,
  REALTIME_PRESENCE_WINDOW_MS,
  type RealtimeTopic,
} from "./realtime-interest";

export {
  getRealtimeRecommendations,
  DEFAULT_REALTIME_RECOMMEND_LIMIT,
  DEFAULT_REALTIME_PEOPLE_LIMIT,
  DEFAULT_REALTIME_BOOTH_LIMIT,
  type RealtimeRecommendationItem,
  type RealtimeRecommendationType,
  type RealtimeRecommendationsResult,
  type GetRealtimeRecommendationsOptions,
} from "./realtime-recommend";

export type {
  MatchDimension,
  MatchDimensionHit,
  PeerIntentProfile,
  RankedCandidate,
  RecallCandidate,
  ViewerIntentProfile,
} from "./types";
