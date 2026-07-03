export type ProbabilityDrawPrize = {
  id: string;
  probability: number;
  remaining: number;
};

/**
 * 按概率区间抽取奖品 ID；落在未分配区间则返回 null（谢谢参与）
 * @param random 0–1 随机数，便于测试注入
 */
export function drawWithProbability(
  prizes: ProbabilityDrawPrize[],
  random = Math.random(),
): string | null {
  const available = prizes.filter(
    (p) => p.remaining > 0 && p.probability > 0,
  );

  const roll = random;
  let cursor = 0;
  for (const prize of available) {
    cursor += prize.probability;
    if (roll < cursor) {
      return prize.id;
    }
  }

  return null;
}

export class ProbabilitySoldOutError extends Error {
  constructor(message = "SOLD_OUT") {
    super(message);
    this.name = "ProbabilitySoldOutError";
  }
}
