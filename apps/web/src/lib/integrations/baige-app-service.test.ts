import { describe, expect, it } from "vitest";
import { EventStatus } from "@connectiq/database";
import {
  formatWhenWhere,
  resolveBaigeAppPhase,
} from "@/lib/integrations/baige-app-service";

describe("baige-app-service phase / whenWhere", () => {
  const now = new Date("2026-05-21T12:00:00.000Z");

  it("maps LIVE / in-range dates to ongoing", () => {
    expect(
      resolveBaigeAppPhase({
        status: EventStatus.LIVE,
        startDate: new Date("2026-05-20"),
        endDate: new Date("2026-05-22"),
        now,
      }),
    ).toBe("ongoing");
  });

  it("maps past endDate to ended", () => {
    expect(
      resolveBaigeAppPhase({
        status: EventStatus.PUBLISHED,
        startDate: new Date("2026-05-01"),
        endDate: new Date("2026-05-10"),
        now,
      }),
    ).toBe("ended");
  });

  it("maps future start to registering", () => {
    expect(
      resolveBaigeAppPhase({
        status: EventStatus.PUBLISHED,
        startDate: new Date("2026-06-01"),
        endDate: new Date("2026-06-03"),
        now,
      }),
    ).toBe("registering");
  });

  it("formats whenWhere", () => {
    expect(
      formatWhenWhere({
        startDate: new Date("2026-05-20T00:00:00Z"),
        endDate: new Date("2026-05-22T00:00:00Z"),
        location: "上海新国际博览中心",
      }),
    ).toMatch(/上海新国际博览中心/);
  });
});
