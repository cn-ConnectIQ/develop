/** 活动意向解析 — 用户自由文本 → 结构化标签（报名/激活时调用，非现场实时） */

export const EVENT_INTENT_PARSE_SYSTEM = `你是 ConnectIQ 会展平台的参会意向解析助手。
任务：从用户自由填写的参会意向文本中，提取结构化标签，用于商务配对与召回。
规则：
1. 只解析用户明确表达的内容，不要臆测或过度推断
2. 标签尽量从「活动标签库」中选择完全一致的文案；库中没有且用户明确提到时才新建标签
3. role 只能从角色选项中选择，无法判断则为 null
4. 只输出 JSON，不要 markdown 或解释
5. 各数组去重，每项 2~12 字，最多各 8 项`;

export type EventTagLibrary = {
  supply: string[];
  demand: string[];
  topics: string[];
  roles: string[];
};

export type ParsedEventIntent = {
  supply_tags: string[];
  demand_tags: string[];
  role: string | null;
  topics: string[];
  industry: string | null;
  region: string | null;
};

export type EventIntentParsePromptInput = {
  rawText: string;
  tagLibrary: EventTagLibrary;
  eventName?: string;
  allowCustomTags?: boolean;
};

export function buildEventIntentParsePrompt(
  input: EventIntentParsePromptInput,
): string {
  const { rawText, tagLibrary, eventName, allowCustomTags = true } = input;

  const libSection = [
    "【活动标签库】",
    `供给标签（SUPPLY）：${tagLibrary.supply.length ? tagLibrary.supply.join("、") : "（无）"}`,
    `需求标签（DEMAND）：${tagLibrary.demand.length ? tagLibrary.demand.join("、") : "（无）"}`,
    `话题标签：${tagLibrary.topics.length ? tagLibrary.topics.join("、") : "（无）"}`,
    `角色选项：${tagLibrary.roles.length ? tagLibrary.roles.join("、") : "（无）"}`,
  ].join("\n");

  const customRule = allowCustomTags
    ? "标签库无匹配且用户明确提及时，可新建简短标签。"
    : "禁止新建标签，只能从标签库中选择。";

  return [
    "请解析以下参会意向，输出 JSON：",
    "",
    "{",
    '  "supply_tags": ["我能提供的标签"],',
    '  "demand_tags": ["我在寻找的标签"],',
    '  "role": "采购|销售|投资|合作|null",',
    '  "topics": ["关注话题"],',
    '  "industry": "行业|null",',
    '  "region": "地域偏好|null"',
    "}",
    "",
    customRule,
    eventName ? `\n活动：${eventName}` : "",
    "",
    libSection,
    "",
    "【用户原文】",
    rawText.trim(),
  ]
    .filter(Boolean)
    .join("\n");
}
