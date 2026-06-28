/** 扫码见面 / 连接请求前的 AI 简报与开场话术 */

export const MEETING_BRIEF_SYSTEM = `你是 ConnectIQ 会展平台的商务社交助手。
任务：为即将见面的两位参会者生成简洁、可执行的见面简报。
要求：
- 语气专业、友好，适合 B2B 展会现场
- 突出双方可能的合作切入点，避免空泛套话
- brief 80~150 字；connection_note 40~80 字，可直接复制发送
- 只输出 JSON，不要 markdown`;

export type MeetingBriefPerson = {
  name: string;
  company?: string;
  title?: string;
  headline?: string;
  valueProposition?: string;
  supplyTags?: string[];
  demandTags?: string[];
};

export type MeetingBriefInput = {
  viewer: MeetingBriefPerson;
  target: MeetingBriefPerson;
  eventName?: string;
  matchReason?: string;
  sharedTopics?: string[];
};

export type MeetingBriefResult = {
  /** 见面简报（展示给发起人阅读） */
  brief: string;
  /** 可直接发送的连接申请话术 */
  connection_note: string;
  /** 建议开场话题（1~3 条） */
  talking_points: string[];
  /** 预估对方接受连接意愿 0~100 */
  accept_rate_hint?: number;
};

export function buildMeetingBriefPrompt(input: MeetingBriefInput): string {
  function formatPerson(label: string, p: MeetingBriefPerson) {
    const role = [p.company, p.title].filter(Boolean).join(" · ");
    const tags = [
      p.supplyTags?.length ? `提供：${p.supplyTags.join("、")}` : null,
      p.demandTags?.length ? `寻找：${p.demandTags.join("、")}` : null,
    ].filter(Boolean);

    return [
      `[${label}]`,
      `姓名：${p.name}`,
      role ? `身份：${role}` : null,
      p.headline ? `简介：${p.headline}` : null,
      p.valueProposition ? `价值主张：${p.valueProposition}` : null,
      tags.length ? `意向：${tags.join("；")}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const lines = [
    "请为以下两位参会者生成见面简报，输出 JSON：",
    "",
    "```json",
    "{",
    '  "brief": "见面简报正文",',
    '  "connection_note": "连接申请话术",',
    '  "talking_points": ["话题1", "话题2"],',
    '  "accept_rate_hint": 65',
    "}",
    "```",
    "",
  ];

  if (input.eventName) {
    lines.push(`活动：${input.eventName}`, "");
  }

  lines.push(formatPerson("发起人（我）", input.viewer), "");
  lines.push(formatPerson("对方", input.target), "");

  if (input.matchReason) {
    lines.push(`系统匹配理由：${input.matchReason}`);
  }
  if (input.sharedTopics?.length) {
    lines.push(`共同话题：${input.sharedTopics.join("、")}`);
  }

  return lines.join("\n");
}
