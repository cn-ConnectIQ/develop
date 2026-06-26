import { ErrorCode } from "@connectiq/types";
import type { NextResponse } from "next/server";
import { createErrorResponse } from "@/lib/api-auth";
import type { EventFeatureFlagKey } from "@/lib/event-feature-flags";
import { isEventFeatureEnabled } from "@/lib/event-feature-flags-server";

const FEATURE_DISABLED_MESSAGES: Partial<Record<EventFeatureFlagKey, string>> =
  {
    lottery: "现场抽奖未开启",
    inviteSystem: "邀请体系未开启",
    aiReferral: "AI 引荐未开启",
    aiBoothRoute: "AI 展位路线未开启",
    highValueBuyerPush: "高价值买家推送未开启",
    speedNetworking: "Speed Networking 未开启",
  };

/** 功能未开启时返回 403 响应，否则返回 null */
export async function guardEventFeature(
  eventId: string,
  key: EventFeatureFlagKey,
): Promise<NextResponse | null> {
  if (!(await isEventFeatureEnabled(eventId, key))) {
    return createErrorResponse(
      FEATURE_DISABLED_MESSAGES[key] ?? "功能未开启",
      ErrorCode.FORBIDDEN,
      403,
    );
  }
  return null;
}
