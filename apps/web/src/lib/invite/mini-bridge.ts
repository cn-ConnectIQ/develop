import {
  InviteRecordStatus,
  ParticipantInviteStatus,
  RegistrationSource,
  UserAccountStatus,
  UserType as PrismaUserType,
  prisma,
} from "@connectiq/database";
import { bindWechatIdentities } from "@/lib/wechat/identity";
import { ensureParticipantForUser } from "@/lib/interaction/participant-user";
import {
  buildMiniLoginResultForInvite,
  exchangePhoneCodeForInvite,
  exchangeWxCodeForInvite,
} from "@/lib/mini-auth-service";

export {
  exchangePhoneCodeForInvite,
  exchangeWxCodeForInvite,
  buildMiniLoginResultForInvite as buildMiniLoginResult,
};

export async function findMiniUserByOpenId(openid: string) {
  const identity = await prisma.userIdentity.findFirst({
    where: { provider: "wechat_mini", value: openid },
    select: { userId: true },
  });
  if (!identity) return null;
  return prisma.user.findUnique({
    where: { id: identity.userId },
    select: { id: true, name: true, phone: true },
  });
}

export async function bindMiniOpenId(
  userId: string,
  openid: string,
  unionid?: string,
) {
  await bindWechatIdentities(userId, {
    miniOpenId: openid,
    unionId: unionid,
  });
}

export async function linkMiniUserToEvent(userId: string, eventId: string) {
  await ensureParticipantForUser(eventId, userId);
}

export async function findOrCreateMiniUserByPhone(
  phone: string,
  options?: {
    name?: string;
    company?: string | null;
    skipPhone?: boolean;
    openid?: string;
    unionid?: string;
  },
) {
  if (options?.skipPhone && options.openid) {
    const existing = await findMiniUserByOpenId(options.openid);
    if (existing) return existing;
    const digest = options.openid.slice(0, 24);
    const user = await prisma.user.create({
      data: {
        email: `wx_guest_${digest}@mini.connectiq.local`,
        passwordHash: "mini_program",
        name: options.name ?? "访客",
        userType: PrismaUserType.END_USER,
        profile: {
          create: {
            accountStatus: UserAccountStatus.SHADOW,
            registrationSource: RegistrationSource.WECHAT,
            company: options.company ?? undefined,
          },
        },
      },
      select: { id: true, name: true, phone: true },
    });
    await bindMiniOpenId(user.id, options.openid, options.unionid);
    return user;
  }

  const existing = await prisma.user.findFirst({
    where: { phone },
    select: { id: true, name: true, phone: true },
  });
  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: `wx_${phone}@mini.connectiq.local`,
      passwordHash: "mini_program",
      name: options?.name ?? `用户${phone.slice(-4)}`,
      phone,
      userType: PrismaUserType.END_USER,
      profile: {
        create: {
          accountStatus: UserAccountStatus.SHADOW,
          registrationSource: RegistrationSource.WECHAT,
          company: options?.company ?? undefined,
        },
      },
    },
    select: { id: true, name: true, phone: true },
  });
}

export async function silentActivateInvite(input: {
  recordId: string;
  campaignId: string;
  participantId: string;
  actingUserId: string;
  tokenUserId: string | null;
}) {
  const record = await prisma.inviteRecord.findUnique({
    where: { id: input.recordId },
  });
  if (!record) return;
  if (record.status === InviteRecordStatus.ACTIVATED) return;

  await prisma.$transaction(async (tx) => {
    await tx.inviteRecord.update({
      where: { id: input.recordId },
      data: {
        status: InviteRecordStatus.ACTIVATED,
        userId: input.actingUserId,
        activatedAt: new Date(),
        clickedAt: record.clickedAt ?? new Date(),
      },
    });
    await tx.participant.update({
      where: { id: input.participantId },
      data: { inviteStatus: ParticipantInviteStatus.ACTIVATED },
    });
    await tx.inviteCampaign.update({
      where: { id: input.campaignId },
      data: { activatedCount: { increment: 1 } },
    });
    const profile = await tx.userProfile.findUnique({
      where: { userId: input.actingUserId },
    });
    if (profile?.accountStatus === UserAccountStatus.SHADOW) {
      await tx.userProfile.update({
        where: { userId: input.actingUserId },
        data: { accountStatus: UserAccountStatus.ACTIVE },
      });
    }
  });
}
