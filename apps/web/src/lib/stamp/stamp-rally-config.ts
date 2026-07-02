export type BoothStampConfig = {
  booth_id: string;
  name: string;
  icon?: string | null;
  weight: number;
  required: boolean;
};

export type StampRallyMeta = {
  prize_quantity?: number | null;
  booth_stamps: BoothStampConfig[];
};

export type StampRallyFormPayload = {
  name: string;
  description?: string | null;
  cover_image?: string | null;
  prize: string;
  prize_image_url?: string | null;
  prize_desc?: string | null;
  prize_quantity?: number | null;
  required_count: number;
  booth_ids: string[];
  booth_stamps?: BoothStampConfig[];
  starts_at?: string | null;
  ends_at?: string | null;
  always_open?: boolean;
  status?: "DRAFT" | "ACTIVE" | "ENDED";
};

export const STAMP_EMOJI_OPTIONS = [
  "🏢",
  "⭐",
  "🎁",
  "🔥",
  "💎",
  "🎯",
  "✨",
  "🏆",
  "📍",
  "🛍️",
  "🤝",
  "💡",
] as const;

export function buildDefaultBoothStamp(
  boothId: string,
  boothCode: string,
  companyName: string,
): BoothStampConfig {
  return {
    booth_id: boothId,
    name: `${boothCode} ${companyName}`.slice(0, 40),
    icon: "⭐",
    weight: 1,
    required: true,
  };
}

export function computeWeightedRequired(stamps: BoothStampConfig[]): number {
  const requiredStamps = stamps.filter((s) => s.required);
  if (requiredStamps.length === 0) {
    return stamps.reduce((sum, s) => sum + s.weight, 0);
  }
  return requiredStamps.reduce((sum, s) => sum + s.weight, 0);
}
