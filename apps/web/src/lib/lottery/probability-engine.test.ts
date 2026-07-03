import { describe, expect, it } from "vitest";
import { drawWithProbability } from "./probability-engine";

describe("drawWithProbability", () => {
  const prizes = [
    { id: "a", probability: 0.15, remaining: 10 },
    { id: "b", probability: 0.25, remaining: 5 },
  ];

  it("落在第一个区间", () => {
    expect(drawWithProbability(prizes, 0.1)).toBe("a");
  });

  it("落在第二个区间", () => {
    expect(drawWithProbability(prizes, 0.2)).toBe("b");
  });

  it("落在未分配区间返回 null", () => {
    expect(drawWithProbability(prizes, 0.9)).toBeNull();
  });

  it("库存为 0 的奖品不参与", () => {
    expect(
      drawWithProbability(
        [
          { id: "a", probability: 0.5, remaining: 0 },
          { id: "b", probability: 0.5, remaining: 1 },
        ],
        0.1,
      ),
    ).toBe("b");
  });
});
