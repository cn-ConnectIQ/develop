import { describe, expect, it } from "vitest";
import { EventStatus, ReviewStatus } from "@connectiq/database";
import { eventLifecycleFields } from "@/lib/event-lifecycle-service";

describe("eventLifecycleFields", () => {
  it("成对映射 DRAFT / PUBLISHED / LIVE / ARCHIVED", () => {
    expect(eventLifecycleFields("DRAFT")).toEqual({
      status: EventStatus.DRAFT,
      reviewStatus: ReviewStatus.DRAFT,
    });
    expect(eventLifecycleFields("PUBLISHED")).toEqual({
      status: EventStatus.PUBLISHED,
      reviewStatus: ReviewStatus.PUBLISHED,
    });
    expect(eventLifecycleFields("LIVE")).toEqual({
      status: EventStatus.LIVE,
      reviewStatus: ReviewStatus.LIVE,
    });
    expect(eventLifecycleFields("ARCHIVED")).toEqual({
      status: EventStatus.ARCHIVED,
      reviewStatus: ReviewStatus.ENDED,
    });
  });
});
