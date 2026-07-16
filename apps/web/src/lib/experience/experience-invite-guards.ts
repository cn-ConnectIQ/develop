import type { TargetFilterInput } from "@/lib/invite/schemas";
import {
  ExperienceAccountError,
  isActiveExperienceUser,
} from "@/lib/experience/experience-account-service";
import { EXPERIENCE_BULK_INVITE_MESSAGE } from "@/lib/experience/experience-invite-messages";

export { EXPERIENCE_BULK_INVITE_MESSAGE };

/** 定向邀请 API：contacts 数量 > 1 视为批量 */
export function isBulkDirectInviteContactCount(count: number): boolean {
  return count > 1;
}

/**
 * 邀请活动 target_filter 是否面向多人。
 * 仅当 participant_ids / import_contacts 恰好 1 人时视为单人。
 */
export function isBulkInviteCampaignTarget(
  filter: TargetFilterInput | undefined | null,
): boolean {
  const f: TargetFilterInput = filter ?? { exclude_activated: true };
  if (f.import_contacts?.length) {
    return f.import_contacts.length > 1;
  }
  if (f.participant_ids?.length) {
    return f.participant_ids.length > 1;
  }
  return true;
}

export async function assertExperienceCanBulkInvite(userId: string) {
  if (!(await isActiveExperienceUser(userId))) return;
  throw new ExperienceAccountError(
    EXPERIENCE_BULK_INVITE_MESSAGE,
    "BULK_INVITE_BLOCKED",
  );
}

export async function assertExperienceCanDirectInvite(
  userId: string,
  contactCount: number,
) {
  if (!(await isActiveExperienceUser(userId))) return;
  if (isBulkDirectInviteContactCount(contactCount)) {
    await assertExperienceCanBulkInvite(userId);
  }
}

export async function assertExperienceCanCreateCampaign(
  userId: string,
  targetFilter: TargetFilterInput | undefined | null,
) {
  if (!(await isActiveExperienceUser(userId))) return;
  if (isBulkInviteCampaignTarget(targetFilter)) {
    await assertExperienceCanBulkInvite(userId);
  }
}

export async function assertExperienceCanSendCampaign(
  userId: string,
  input: {
    totalTarget?: number | null;
    targetFilter: unknown;
  },
) {
  if (!(await isActiveExperienceUser(userId))) return;
  if (input.totalTarget != null && input.totalTarget > 1) {
    await assertExperienceCanBulkInvite(userId);
    return;
  }
  if (isBulkInviteCampaignTarget(input.targetFilter as TargetFilterInput)) {
    await assertExperienceCanBulkInvite(userId);
  }
}
