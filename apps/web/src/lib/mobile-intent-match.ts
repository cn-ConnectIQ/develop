export function scoreIntentMatch(
  my: { supplyTags: string[]; demandTags: string[] },
  peer: { supplyTags: string[]; demandTags: string[] },
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  for (const tag of my.demandTags) {
    if (peer.supplyTags.includes(tag)) {
      score += 30;
      reasons.push(`对方供给「${tag}」匹配你的需求`);
    }
  }
  for (const tag of my.supplyTags) {
    if (peer.demandTags.includes(tag)) {
      score += 30;
      reasons.push(`你的供给「${tag}」匹配对方需求`);
    }
  }
  for (const tag of my.demandTags) {
    if (peer.demandTags.includes(tag)) {
      score += 10;
      reasons.push(`共同关注「${tag}」`);
    }
  }

  return {
    score,
    reason: reasons[0] ?? "基于意向标签的智能推荐",
  };
}
