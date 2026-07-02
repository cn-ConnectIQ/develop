export type RatingPollConfig = {
  minScore: number;
  maxScore: number;
  lowLabel: string;
  highLabel: string;
};

export const DEFAULT_RATING_POLL_CONFIG: RatingPollConfig = {
  minScore: 1,
  maxScore: 5,
  lowLabel: "非常不满意",
  highLabel: "非常满意",
};

const CONFIG_PREFIX = "__rating__:";

export function isRatingConfigOption(text: string): boolean {
  return text.startsWith(CONFIG_PREFIX);
}

export function encodeRatingConfigOption(
  config: RatingPollConfig,
): string {
  return `${CONFIG_PREFIX}${JSON.stringify(config)}`;
}

export function parseRatingConfigFromOptions(
  options: Array<{ id: string; text: string }>,
): RatingPollConfig {
  const configOption = options.find((o) => isRatingConfigOption(o.text));
  if (!configOption) {
    return { ...DEFAULT_RATING_POLL_CONFIG };
  }

  try {
    const parsed = JSON.parse(
      configOption.text.slice(CONFIG_PREFIX.length),
    ) as Partial<RatingPollConfig>;
    return {
      minScore: clampScore(parsed.minScore ?? DEFAULT_RATING_POLL_CONFIG.minScore),
      maxScore: clampScore(parsed.maxScore ?? DEFAULT_RATING_POLL_CONFIG.maxScore),
      lowLabel: parsed.lowLabel ?? DEFAULT_RATING_POLL_CONFIG.lowLabel,
      highLabel: parsed.highLabel ?? DEFAULT_RATING_POLL_CONFIG.highLabel,
    };
  } catch {
    return { ...DEFAULT_RATING_POLL_CONFIG };
  }
}

export function buildRatingPollOptions(
  existing: Array<{ id: string; text: string }>,
  config: RatingPollConfig,
): Array<{ id?: string; text: string }> {
  const configText = encodeRatingConfigOption(config);
  const configOption = existing.find((o) => isRatingConfigOption(o.text));
  const rest = existing.filter((o) => !isRatingConfigOption(o.text));

  return [
    { id: configOption?.id, text: configText },
    ...rest.map((o) => ({ id: o.id, text: o.text })),
  ];
}

export function ratingScoreRange(config: RatingPollConfig): number[] {
  const min = Math.min(config.minScore, config.maxScore);
  const max = Math.max(config.minScore, config.maxScore);
  const values: number[] = [];
  for (let n = min; n <= max; n += 1) {
    values.push(n);
  }
  return values;
}

function clampScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}
