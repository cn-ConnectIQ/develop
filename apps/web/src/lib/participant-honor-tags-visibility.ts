import { SystemRole, UserType, prisma } from "@connectiq/database";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import { isOrgAdminUsable } from "@/lib/org-access";
import { resolveDisplayTags } from "@/lib/participant-tags";

/** 主办方/工作人员等管理者视角（不受 show_tags_to_participants 限制） */
export async function isEventHonorTagsManager(
  viewerId: string,
  eventId: string,
): Promise<boolean> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { organizerId: true, orgId: true },
  });
  if (!event) return false;

  if (event.organizerId === viewerId) return true;

  const user = await prisma.user.findUnique({
    where: { id: viewerId },
    select: {
      userType: true,
      orgId: true,
      org: { select: { id: true, adminStatus: true } },
      ownedOrg: { select: { id: true, adminStatus: true } },
    },
  });
  if (!user) return false;

  if (user.userType === UserType.ACCOUNT_ADMIN) {
    const org = user.org ?? user.ownedOrg;
    if (org && org.id === event.orgId && isOrgAdminUsable(org.adminStatus)) {
      return true;
    }
  }

  const participant = await findParticipantForUser(eventId, viewerId);
  if (
    participant?.systemRole === SystemRole.ORGANIZER ||
    participant?.systemRole === SystemRole.STAFF
  ) {
    return true;
  }

  return false;
}

export async function resolveHonorTagsForViewer(
  viewerId: string | null | undefined,
  targetUserId: string,
  eventId: string | null | undefined,
): Promise<string[] | undefined> {
  if (!eventId) return undefined;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { showTagsToParticipants: true },
  });
  if (!event) return undefined;

  const participant = await findParticipantForUser(eventId, targetUserId);
  if (!participant) return undefined;

  const tags = resolveDisplayTags(participant.tags, participant.role);
  if (tags.length === 0) return undefined;

  if (event.showTagsToParticipants) {
    return tags;
  }

  if (!viewerId) return undefined;

  const isManager = await isEventHonorTagsManager(viewerId, eventId);
  return isManager ? tags : undefined;
}

export async function resolveHonorTagsForManager(
  targetUserId: string,
  eventId: string,
): Promise<string[] | undefined> {
  const participant = await findParticipantForUser(eventId, targetUserId);
  if (!participant) return undefined;
  const tags = resolveDisplayTags(participant.tags, participant.role);
  return tags.length > 0 ? tags : undefined;
}
