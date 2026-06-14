export type WordCloudItem = { text: string; count: number };

type TextResponse = { textAnswer: string | null };

export function aggregateWordCloud(responses: TextResponse[]): WordCloudItem[] {
  const map = new Map<string, number>();

  for (const r of responses) {
    const raw = r.textAnswer?.trim();
    if (!raw) continue;

    const tokens = raw
      .split(/[\s,，、；;。.!！?？]+/)
      .map((t: string) => t.trim())
      .filter((t: string) => t.length >= 2);

    if (tokens.length === 0) {
      map.set(raw, (map.get(raw) ?? 0) + 1);
      continue;
    }

    for (const token of tokens) {
      map.set(token, (map.get(token) ?? 0) + 1);
    }
  }

  return [...map.entries()]
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 60);
}

export function aggregatePollOptions(
  options: Array<{ id: string; text: string }>,
  responses: Array<{ optionId: string | null }>,
) {
  const total = responses.length;
  return options
    .map((option) => {
      const count = responses.filter((r) => r.optionId === option.id).length;
      return {
        id: option.id,
        text: option.text,
        count,
        percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
}
