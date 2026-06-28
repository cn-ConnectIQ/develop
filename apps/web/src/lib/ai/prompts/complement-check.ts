import { SignalType } from "@connectiq/database";

export type ComplementCheckPerson = {
  candidate_id: string;
  name: string;
  role?: string | null;
  supply_tags: string[];
  demand_tags: string[];
  topics?: string[];
};

export type ComplementCheckViewer = {
  name?: string;
  role?: string | null;
  supply_tags: string[];
  demand_tags: string[];
  topics?: string[];
  raw_intent_text?: string | null;
};

export type ComplementCheckLLMResult = {
  candidate_id: string;
  complementary: boolean;
  /** 0~12，实质互补程度 */
  boost: number;
  reason: string;
};

export const COMPLEMENT_CHECK_SYSTEM = `你是 B2B 展会智能配对的语义判断助手。
任务：判断两位参会者的供需标签是否「实质互补」（而非仅字面相似或完全无关）。

实质互补示例：
- A 提供「边缘计算盒子」，B 寻找「产线 AI 质检」→ 互补（工业场景可结合）
- A 是「采购」找「MES 系统」，B 是「销售」提供「MES 方案」→ 互补

非互补示例：
- 标签完全同义重复，无新增价值
- 行业/场景明显冲突且无法协作
- 一方空白或过于笼统，无法判断时 complementary=false

只依据给定标签与角色判断，不要编造未提供的信息。
返回 JSON 数组，每项字段：candidate_id, complementary (boolean), boost (0-12 整数), reason (20字内中文)。`;

export function buildComplementCheckPrompt(
  viewer: ComplementCheckViewer,
  peers: ComplementCheckPerson[],
): string {
  const viewerBlock = JSON.stringify(
    {
      supply: viewer.supply_tags,
      demand: viewer.demand_tags,
      role: viewer.role,
      topics: viewer.topics ?? [],
      intent: viewer.raw_intent_text?.slice(0, 200) ?? null,
    },
    null,
    2,
  );

  const peerBlocks = peers
    .map(
      (p) =>
        `- id=${p.candidate_id} ${p.name} | 角色:${p.role ?? "—"} | 提供:[${p.supply_tags.join("、")}] | 寻找:[${p.demand_tags.join("、")}]`,
    )
    .join("\n");

  return `【我方 viewer】
${viewerBlock}

【待判断候选（最多 ${peers.length} 人）】
${peerBlocks}

请逐人判断：TA 与我是否实质互补？若互补，boost 给 6~12；弱相关 3~5；不互补 0。
返回 JSON：{ "results": [ { "candidate_id", "complementary", "boost", "reason" } ] }`;
}

export function sanitizeComplementResults(
  raw: unknown,
  allowedIds: Set<string>,
): ComplementCheckLLMResult[] {
  if (!raw || typeof raw !== "object") return [];
  const results = (raw as { results?: unknown }).results;
  if (!Array.isArray(results)) return [];

  const out: ComplementCheckLLMResult[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const candidateId = String(row.candidate_id ?? "");
    if (!allowedIds.has(candidateId)) continue;

    const complementary = Boolean(row.complementary);
    let boost = Number(row.boost);
    if (!Number.isFinite(boost)) boost = complementary ? 6 : 0;
    boost = Math.max(0, Math.min(12, Math.round(boost)));
    if (!complementary) boost = 0;

    const reason =
      typeof row.reason === "string" && row.reason.trim()
        ? row.reason.trim().slice(0, 40)
        : complementary
          ? "供需实质互补"
          : "";

    out.push({ candidate_id: candidateId, complementary, boost, reason });
  }
  return out;
}

/** 从信号 payload 推断意向关键词（与 matching-service 对齐） */
export function inferIntentFromSignalPayload(
  signalType: SignalType,
  payload: Record<string, unknown>,
): string | null {
  switch (signalType) {
    case SignalType.POLL_ANSWERED: {
      const options = payload.selected_options;
      if (Array.isArray(options) && options.length > 0) {
        return String(options[0]);
      }
      const title = payload.poll_title;
      if (typeof title === "string") return title;
      break;
    }
    case SignalType.QNA_ASKED: {
      const q = payload.question_text;
      if (typeof q === "string" && q.trim()) return q.trim().slice(0, 80);
      break;
    }
    case SignalType.BOOTH_LEAD_CAPTURED: {
      const grade = payload.intent_level;
      return typeof grade === "string" ? `${grade}级采购意向` : "展位留资";
    }
    case SignalType.BOOTH_SCAN:
      return "展位参观";
    case SignalType.INTERACTION_JOINED: {
      const name = payload.session_name ?? payload.interaction_name;
      if (typeof name === "string") return name;
      break;
    }
    default:
      break;
  }
  return null;
}
