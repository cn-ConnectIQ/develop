import { ReferralStatus, prisma } from "@connectiq/database";
import { countActiveConnections } from "@/lib/connections-service";

export async function fetchUserValueDashboard(userId: string) {
  const [connectionsCount, pointsProfile, referralIntroducer, referralRecipient] =
    await Promise.all([
      countActiveConnections(userId),
      prisma.userProfile.findUnique({
        where: { userId },
        select: { pointsBalance: true },
      }),
      prisma.businessReferral.count({
        where: { introducerId: userId },
      }),
      prisma.businessReferral.count({
        where: {
          recipientId: userId,
          status: { in: [ReferralStatus.PENDING, ReferralStatus.ACCEPTED] },
        },
      }),
    ]);

  const referralsCount = referralIntroducer + referralRecipient;

  return {
    connections_count: connectionsCount,
    referrals_count: referralsCount,
    points_balance: pointsProfile?.pointsBalance ?? 0,
  };
}
