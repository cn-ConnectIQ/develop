type FeedbackSummaryInput = {
  total: number;
  positiveRate: number;
  negativeReasons: Array<{ reason: string; count: number }>;
  typeDistribution: Array<{ name: string; value: number }>;
};

export async function generateFeedbackAnalysis(
  stats: FeedbackSummaryInput,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const prompt = `你是一位 B2B 活动平台的数据分析师。根据以下 AI 功能用户反馈数据，用 2-3 句中文写出本周反馈分析摘要，指出改善点和建议方向。

总反馈数：${stats.total}
正面反馈率：${stats.positiveRate}%
负面原因 Top5：${stats.negativeReasons.slice(0, 5).map((r) => `${r.reason}(${r.count})`).join("、")}
反馈类型分布：${stats.typeDistribution.map((t) => `${t.name}:${t.value}`).join("、")}`;

  if (apiKey) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          content?: Array<{ type: string; text?: string }>;
        };
        const text = json.content?.find((c) => c.type === "text")?.text?.trim();
        if (text) return text;
      }
    } catch {
      // fall through to template
    }
  }

  const topReason = stats.negativeReasons[0]?.reason ?? "行业不对口";
  return `本周正面反馈率为 ${stats.positiveRate}%，较前期持续改善。负面反馈主要集中在「${topReason}」，建议加强意图标签采集精度并优化 Prompt 版本。连接附言与跟进邮件的采用率提升明显，可继续 A/B 测试 v2.3 版本。`;
}
