export type ReelColumnEntry = {
  id: string;
  name: string;
  company?: string | null;
};

export type ReelOfHonorPhase = "spinning" | "stopping" | "revealed";

export type ReelWinnerInfo = {
  name: string;
  company?: string | null;
  prize_name: string;
  prize_rank: number;
  verification_code?: string | null;
  pickup_note?: string;
};

export type ReelOfHonorProps = {
  phase: ReelOfHonorPhase;
  /** 三列候选人池（由后端/Realtime 传入，前端不随机生成） */
  columns: [ReelColumnEntry[], ReelColumnEntry[], ReelColumnEntry[]];
  /** 每列最终停下的条目索引（后端确定） */
  finalIndices: [number, number, number];
  /** 列停止顺序，如 [0, 1, 2] */
  stopSequence: readonly number[];
  /** 已完成停止的列索引（stopping 阶段由父组件按序推进） */
  stoppedColumns?: readonly number[];
  winner?: ReelWinnerInfo | null;
  tierLabel?: string | null;
};

export type StarlightOrbitEntry = ReelColumnEntry;

export type StarlightOrbitPhase = "spinning" | "stopping" | "revealed";

export type StarlightOrbitProps = {
  phase: StarlightOrbitPhase;
  /** 轨道上的候选人（由后端/Realtime 传入） */
  entries: StarlightOrbitEntry[];
  /** 中奖者在 entries 中的索引（后端确定，非随机） */
  winnerIndex: number;
  winner?: ReelWinnerInfo | null;
  tierLabel?: string | null;
};

export type PrecisionRollerPhase = "spinning" | "stopping" | "revealed";

export type PrecisionRollerProps = {
  phase: PrecisionRollerPhase;
  /** 候选人姓名池（用于滚轮字符集，由后端传入） */
  entryNames: string[];
  /** 中奖者姓名（后端确定，逐字驱动停轮） */
  targetName: string;
  /** 每列字符集与最终字符索引（由 targetName 推导，非随机） */
  charsets: string[][];
  finalIndices: number[];
  /** 滚轮停止顺序 */
  stopSequence: readonly number[];
  /** 已完成停止的滚轮索引 */
  stoppedRollers?: readonly number[];
  winner?: ReelWinnerInfo | null;
  tierLabel?: string | null;
};

export type ScrollUnveilingPhase = "spinning" | "stopping" | "revealed";

export type ScrollUnveilingProps = {
  phase: ScrollUnveilingPhase;
  /** 卷轴标题（等待展开时展示） */
  heading: string;
  /** 揭晓姓名（后端确定） */
  revealName: string;
  revealCompany?: string | null;
  winner?: ReelWinnerInfo | null;
  tierLabel?: string | null;
};

/** 大屏抽奖动效统一阶段 */
export type LotteryAnimationPhase = "spinning" | "stopping" | "revealed";

/** 各动效组件统一 props（phase / winner 由 Realtime 驱动） */
export type LotteryAnimationProps = {
  phase: LotteryAnimationPhase;
  winner: ReelWinnerInfo | null;
  stopSequence?: readonly number[];
  stoppedIndexes?: readonly number[];
  title: string;
  tierLabel?: string | null;
  entryCount: number;
  rollingEntries: ReelColumnEntry[];
};
