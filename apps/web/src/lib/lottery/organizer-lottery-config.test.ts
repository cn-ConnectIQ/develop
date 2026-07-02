import { describe, expect, it } from "vitest";
import {
  createOrganizerLotterySchema,
  normalizeOrganizerEligibility,
} from "./organizer-lottery-config";

describe("createOrganizerLotterySchema", () => {
  it("接受空 id 与空 stamp_rally_id", () => {
    const result = createOrganizerLotterySchema.safeParse({
      id: "",
      title: "闭幕全场大抽奖",
      prizes: [{ name: "一等奖", quantity: 1, prize_type: "PHYSICAL" }],
      eligibility: {
        require_checkin: true,
        min_interactions: 2,
        require_stamp_rally: false,
        stamp_rally_id: "",
        min_connections: null,
      },
      publish: false,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBeUndefined();
      expect(result.data.eligibility?.stamp_rally_id).toBeNull();
    }
  });
});

describe("normalizeOrganizerEligibility", () => {
  it("将空白 stamp_rally_id 规范为 null", () => {
    expect(
      normalizeOrganizerEligibility({
        stamp_rally_id: "   ",
      }).stamp_rally_id,
    ).toBeNull();
  });
});
