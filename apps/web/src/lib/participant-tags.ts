/** 系统预置身份标签（主办方可选用，也可自定义；不影响权限） */
export const PRESET_PARTICIPANT_TAGS = [
  "VIP",
  "Speaker",
  "Sponsor",
  "Media",
  "Investor",
] as const;

export type PresetParticipantTag = (typeof PRESET_PARTICIPANT_TAGS)[number];

/** AI 配对推荐权重（仅 honor tags，不含 system_role） */
export const TAG_RECOMMENDATION_WEIGHTS: Record<PresetParticipantTag, number> = {
  VIP: 2,
  Speaker: 1,
  Sponsor: 1,
  Media: 0,
  Investor: 1,
};

export const PARTICIPANT_TAG_LABELS: Record<string, string> = {
  VIP: "VIP",
  Speaker: "演讲者",
  Sponsor: "赞助商",
  Media: "媒体",
  Investor: "投资人",
};

export const PARTICIPANT_TAG_STYLES: Record<
  string,
  { className: string; avatarClass?: string }
> = {
  VIP: {
    className: "border-[#EF9F27]/40 bg-[#EF9F27] text-white",
    avatarClass: "bg-[#EF9F27]/15 text-[#EF9F27]",
  },
  Speaker: {
    className: "border-[#2563CB]/40 bg-[#2563CB] text-white",
    avatarClass: "bg-[#2563CB]/15 text-[#2563CB]",
  },
  Sponsor: {
    className: "border-[#0F6E56]/40 bg-[#0F6E56] text-white",
  },
  Media: {
    className: "border-gray-300 bg-gray-200 text-gray-700",
  },
  Investor: {
    className: "bg-brand-green-light text-brand-green border-brand-green/30",
  },
};

export function normalizeParticipantTags(raw: string[] | undefined | null): string[] {
  if (!raw?.length) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of raw) {
    const trimmed = tag.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

export function mergeParticipantTags(
  ...groups: Array<string[] | undefined | null>
): string[] {
  return normalizeParticipantTags(groups.flatMap((g) => g ?? []));
}

export function participantHasTag(tags: string[], tag: string): boolean {
  const needle = tag.trim().toLowerCase();
  return tags.some((t) => t.trim().toLowerCase() === needle);
}

export function resolveDisplayTags(
  tags: string[],
  legacyRole?: string,
): string[] {
  let resolved = [...tags];
  if (
    legacyRole === "SPEAKER" &&
    !participantHasTag(resolved, "Speaker")
  ) {
    resolved = mergeParticipantTags(resolved, ["Speaker"]);
  }
  return resolved;
}

/** @deprecated 工作人员请用 system_role=ORGANIZER_STAFF；保留以兼容历史 Staff 标签数据 */
export function isStaffTagged(tags: string[]): boolean {
  return participantHasTag(tags, "Staff");
}

export function isVipTagged(tags: string[]): boolean {
  return participantHasTag(tags, "VIP");
}

export function isSpeakerTagged(tags: string[]): boolean {
  return participantHasTag(tags, "Speaker");
}

export function getTagRecommendationWeight(tags: string[]): number {
  let weight = 0;
  for (const tag of tags) {
    const preset = PRESET_PARTICIPANT_TAGS.find(
      (p) => p.toLowerCase() === tag.toLowerCase(),
    ) as PresetParticipantTag | undefined;
    if (preset) weight += TAG_RECOMMENDATION_WEIGHTS[preset];
  }
  return weight;
}

export function getTagStyle(tag: string) {
  const preset = PRESET_PARTICIPANT_TAGS.find(
    (p) => p.toLowerCase() === tag.toLowerCase(),
  );
  if (preset) return PARTICIPANT_TAG_STYLES[preset];
  return {
    className: "border-border-light bg-gray-50 text-text-muted",
  };
}

export function getTagLabel(tag: string): string {
  const preset = PRESET_PARTICIPANT_TAGS.find(
    (p) => p.toLowerCase() === tag.toLowerCase(),
  );
  if (preset) return PARTICIPANT_TAG_LABELS[preset] ?? preset;
  return tag;
}

/** 导入/Excel 中文别名 → 标准 tag 值 */
export const PARTICIPANT_TAG_IMPORT_ALIASES: Record<string, string> = {
  演讲嘉宾: "Speaker",
  演讲者: "Speaker",
  赞助商: "Sponsor",
  媒体: "Media",
  投资人: "Investor",
  嘉宾: "VIP",
};

export function resolveParticipantTagAlias(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  const preset = PRESET_PARTICIPANT_TAGS.find(
    (p) => p.toLowerCase() === trimmed.toLowerCase(),
  );
  if (preset) return preset;
  return PARTICIPANT_TAG_IMPORT_ALIASES[trimmed] ?? trimmed;
}

/** 解析 Excel/CSV 标签列：「VIP,Speaker」或「VIP；演讲嘉宾」 */
export function parseTagsFromCell(value: string | undefined | null): string[] {
  if (!value?.trim()) return [];
  return normalizeParticipantTags(
    value
      .split(/[,，;；|/、\s]+/)
      .filter(Boolean)
      .map(resolveParticipantTagAlias),
  );
}
