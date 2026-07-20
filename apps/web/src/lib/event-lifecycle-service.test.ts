import { describe, expect, it } from "vitest";
import { EventStatus, ReviewStatus } from "@connectiq/database";
import {
  eventLifecycleFields,
  isLifecyclePairConsistent,
  reviewStatusForEventStatus,
} from "@/lib/event-lifecycle-service";

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

  it("status 为唯一真相，reviewStatus 由其推导", () => {
    expect(reviewStatusForEventStatus(EventStatus.DRAFT)).toBe(
      ReviewStatus.DRAFT,
    );
    expect(reviewStatusForEventStatus(EventStatus.LIVE)).toBe(
      ReviewStatus.LIVE,
    );
    expect(reviewStatusForEventStatus(EventStatus.ARCHIVED)).toBe(
      ReviewStatus.ENDED,
    );
  });

  it("能识别脏数据对", () => {
    expect(
      isLifecyclePairConsistent(EventStatus.DRAFT, ReviewStatus.LIVE),
    ).toBe(false);
    expect(
      isLifecyclePairConsistent(EventStatus.LIVE, ReviewStatus.LIVE),
    ).toBe(true);
  });
});
