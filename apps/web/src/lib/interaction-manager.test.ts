import { describe, expect, it } from "vitest";
import {
  getInteractionResponseCount,
  normalizePollOptionsForType,
} from "./interaction-manager";
import { encodeRatingConfigOption } from "./rating-poll-config";

describe("getInteractionResponseCount", () => {
  it("poll 缺少 _count 时不抛错", () => {
    expect(
      getInteractionResponseCount({
        id: "poll-1",
        kind: "poll",
        title: "测试投票",
        type: "SINGLE_CHOICE",
        status: "DRAFT",
        closesAt: null,
        scheduledAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        options: [],
      } as never),
    ).toBe(0);
  });

  it("lottery 使用 entryCount 或 _count.entries", () => {
    expect(
      getInteractionResponseCount({
        id: "lottery-1",
        kind: "lottery",
        title: "测试抽奖",
        status: "OPEN",
        entryCount: 3,
      } as never),
    ).toBe(3);
  });
});

describe("normalizePollOptionsForType", () => {
  it("从评分切到投票时移除 __rating__ 配置项", () => {
    const ratingConfig = encodeRatingConfigOption({
      minScore: 1,
      maxScore: 5,
      lowLabel: "非常不满意",
      highLabel: "非常满意",
    });
    const result = normalizePollOptionsForType("SINGLE_CHOICE", [
      { id: "cfg", text: ratingConfig },
      { id: "o1", text: "选项 1" },
    ]);
    expect(result.some((o) => o.text.startsWith("__rating__:"))).toBe(false);
    expect(result.map((o) => o.text)).toEqual(["选项 1", "选项 2"]);
  });

  it("从评分切到投票且无有效选项时使用默认选项", () => {
    const ratingConfig = encodeRatingConfigOption({
      minScore: 1,
      maxScore: 5,
      lowLabel: "非常不满意",
      highLabel: "非常满意",
    });
    const result = normalizePollOptionsForType("SINGLE_CHOICE", [
      { id: "cfg", text: ratingConfig },
    ]);
    expect(result.map((o) => o.text)).toEqual(["选项 1", "选项 2"]);
  });
});
