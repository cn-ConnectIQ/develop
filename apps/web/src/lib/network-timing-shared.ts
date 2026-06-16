export type ContactTiming = "hot" | "warm" | "cool" | "cold";

export function computeContactTiming(input: {
  depth_score: number;
  connected_at: string;
  last_interaction_at?: string | null;
}): { contact_timing: ContactTiming; timing_reason: string | null } {
  const anchor = input.last_interaction_at ?? input.connected_at;
  const daysSince = Math.floor(
    (Date.now() - new Date(anchor).getTime()) / (24 * 60 * 60 * 1000),
  );

  if (daysSince >= 14 && input.depth_score >= 5) {
    return { contact_timing: "hot", timing_reason: "现在是好时机" };
  }
  if (daysSince >= 7 && input.depth_score >= 4) {
    return { contact_timing: "warm", timing_reason: "近期可以关注" };
  }
  if (daysSince <= 7) {
    return { contact_timing: "cool", timing_reason: null };
  }
  if (daysSince > 30) {
    return { contact_timing: "cold", timing_reason: "暂时搁置" };
  }
  return { contact_timing: "cool", timing_reason: null };
}
