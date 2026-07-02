import { describe, expect, it } from "vitest";
import { getInteractionResponseCount } from "./interaction-manager";

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
