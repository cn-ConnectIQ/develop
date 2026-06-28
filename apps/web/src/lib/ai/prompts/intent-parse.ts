/** 从自由文本 / 行为信号中解析结构化商务意向 */

export const INTENT_PARSE_SYSTEM = `你是 ConnectIQ 会展平台的商务意向分析助手。
任务：从参会者的描述、问答、投票选择或展位行为中，提取结构化的供需意向标签。
要求：
- 只输出 JSON，不要 markdown 或解释性文字
- 标签简洁（2-8 字），面向 B2B 商务场景
- 区分 SUPPLY（我能提供）与 DEMAND（我在寻找）
- confidence 取 0~1，表示判断置信度
- 无法判断时 tags 为空数组`;

export type IntentParseInput = {
  /** 原始文本：问答内容、投票选项、自我介绍等 */
  text: string;
  /** 信号来源，帮助模型理解语境 */
  source?: "poll" | "qna" | "booth_lead" | "profile" | "chat" | "other";
  /** 活动/行业背景（可选） */
  eventContext?: string;
};

export type IntentParseResult = {
  tags: Array<{
    label: string;
    type: "SUPPLY" | "DEMAND";
    confidence: number;
  }>;
  summary: string;
};

export function buildIntentParsePrompt(input: IntentParseInput): string {
  const sourceLabel: Record<NonNullable<IntentParseInput["source"]>, string> = {
    poll: "现场投票",
    qna: "问答互动",
    booth_lead: "展位留资",
    profile: "个人资料",
    chat: "对话消息",
    other: "其他",
  };

  const lines = [
    "请解析以下参会者意向，输出 JSON：",
    "",
    "```json",
    "{",
    '  "tags": [{ "label": "标签", "type": "SUPPLY|DEMAND", "confidence": 0.85 }],',
    '  "summary": "一句话概括（30字内）"',
    "}",
    "```",
    "",
    `来源：${input.source ? sourceLabel[input.source] : "未知"}`,
  ];

  if (input.eventContext) {
    lines.push(`活动背景：${input.eventContext}`);
  }

  lines.push("", "待解析内容：", input.text.trim());

  return lines.join("\n");
}
