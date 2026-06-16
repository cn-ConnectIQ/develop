import type { OrgJoinSource } from "@connectiq/database";

export const JOIN_SOURCE_LABELS: Record<OrgJoinSource, string> = {
  PARTICIPATED_EVENT: "参与活动",
  LEAD_CAPTURED: "被采集",
  INVITED: "邀请激活",
  FOLLOWED: "主动关注",
  QR_SCANNED: "扫码",
};
