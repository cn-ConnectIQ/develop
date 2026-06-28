/** 连接名片 — LLM 见面简报（严格防幻觉） */

export const MATCH_BRIEF_SYSTEM = `你是 ConnectIQ 会展平台的商务社交助手。
任务：基于已提供的双方结构化资料和匹配维度，生成见面简报。
铁律：
1. 只能使用输入中明确提供的资料，绝对不要推测、编造或补充任何未提供的信息
2. 不要假设对方的隐藏需求、预算、决策权或合作意愿
3. brief 控制在 2-3 句，口语化，可直接展示给参会者
4. match_reason 一句话（15~30字），用于卡片摘要
5. 只输出 JSON，不要 markdown`;

export type MatchBriefProfile = {
  name: string;
  company?: string | null;
  title?: string | null;
  role?: string | null;
  industry?: string | null;
  region?: string | null;
  supplyTags?: string[];
  demandTags?: string[];
  topics?: string[];
  headline?: string | null;
};

export type MatchBriefDimension = {
  dimension: string;
  label: string;
  detail?: string;
};

export type MatchBriefLLMResult = {
  brief: string;
  match_reason: string;
};

function formatProfileBlock(label: string, p: MatchBriefProfile): string {
  const lines = [
    `[${label}]`,
    `姓名：${p.name}`,
    p.company ? `公司：${p.company}` : null,
    p.title ? `职位/头衔：${p.title}` : null,
    p.role ? `角色：${p.role}` : null,
    p.industry ? `行业：${p.industry}` : null,
    p.region ? `地域：${p.region}` : null,
    p.headline ? `简介：${p.headline}` : null,
    p.supplyTags?.length ? `可提供：${p.supplyTags.join("、")}` : null,
    p.demandTags?.length ? `在寻找：${p.demandTags.join("、")}` : null,
    p.topics?.length ? `关注话题：${p.topics.join("、")}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

export function buildMatchBriefPrompt(input: {
  viewer: MatchBriefProfile;
  target: MatchBriefProfile;
  matchDimensions: MatchBriefDimension[];
  matchScore: number;
  eventName?: string;
}): string {
  const dimLines =
    input.matchDimensions.length > 0
      ? input.matchDimensions.map((d) => `- ${d.label}`).join("\n")
      : "- （无明确匹配维度，仅基于双方资料做保守介绍）";

  return [
    "请生成见面简报，输出 JSON：",
    '{ "brief": "2-3句口语化简报", "match_reason": "一句话匹配原因" }',
    "",
    input.eventName ? `活动：${input.eventName}` : "",
    `匹配分（规则层）：${input.matchScore}`,
    "",
    "【命中的匹配维度】",
    dimLines,
    "",
    formatProfileBlock("发起人（我）", input.viewer),
    "",
    formatProfileBlock("对方", input.target),
  ]
    .filter(Boolean)
    .join("\n");
}
