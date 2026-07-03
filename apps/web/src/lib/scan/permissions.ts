import {
  InviteStatus,
  OrgStaffRole,
  prisma,
  ScanActionType,
  ScanResult,
  SystemRole,
} from "@connectiq/database";
import { requireEventAccessCheck } from "@/lib/api-auth";
import { findParticipantForUser } from "@/lib/interaction/participant-user";
import type { ScanHandlerOutcome } from "@/lib/scan/types";

/** 操作端角色（权限矩阵列） */
export type ScanOperatorRole = "ORGANIZER" | "STAFF" | "EXHIBITOR" | "NONE";

export type ActionPermissionInput = {
  eventId: string;
  operatorId: string;
  action: ScanActionType;
  actionRef?: string;
};

/** 活动主办方后台权限（组织管理员 / 平台管理员） */
export async function hasOrganizerConsoleAccess(
  userId: string,
  eventId: string,
): Promise<boolean> {
  void userId;
  const eventCheck = await requireEventAccessCheck(eventId);
  return !("error" in eventCheck);
}

/** 展商 / 展位工作人员对指定展位的操作权限 */
export async function hasBoothStaffAccess(
  userId: string,
  eventId: string,
  boothId: string,
): Promise<boolean> {
  const booth = await prisma.exhibitorBooth.findFirst({
    where: {
      id: boothId,
      eventId,
      OR: [
        { operatorUserId: userId },
        {
          companyOrg: {
            staff: {
              some: {
                userId,
                status: InviteStatus.ACCEPTED,
                role: {
                  in: [
                    OrgStaffRole.OWNER,
                    OrgStaffRole.ADMIN,
                    OrgStaffRole.OPERATOR,
                  ],
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return !!booth;
}

/** 活动下任意展位工作人员 */
export async function hasEventBoothStaffAccess(
  userId: string,
  eventId: string,
): Promise<boolean> {
  const booth = await prisma.exhibitorBooth.findFirst({
    where: {
      eventId,
      OR: [
        { operatorUserId: userId },
        {
          companyOrg: {
            staff: {
              some: {
                userId,
                status: InviteStatus.ACCEPTED,
                role: {
                  in: [
                    OrgStaffRole.OWNER,
                    OrgStaffRole.ADMIN,
                    OrgStaffRole.OPERATOR,
                  ],
                },
              },
            },
          },
        },
      ],
    },
    select: { id: true },
  });
  return !!booth;
}

/**
 * 解析操作人员在当前活动下的角色（权限矩阵）
 * ORGANIZER > STAFF > EXHIBITOR
 */
export async function resolveScanOperatorRole(
  userId: string,
  eventId: string,
): Promise<ScanOperatorRole> {
  if (await hasOrganizerConsoleAccess(userId, eventId)) {
    return "ORGANIZER";
  }

  const participant = await findParticipantForUser(eventId, userId);
  if (participant?.systemRole === SystemRole.ORGANIZER) {
    return "ORGANIZER";
  }
  if (participant?.systemRole === SystemRole.STAFF) {
    return "STAFF";
  }

  if (
    participant?.systemRole === SystemRole.EXHIBITOR ||
    (await hasEventBoothStaffAccess(userId, eventId))
  ) {
    return "EXHIBITOR";
  }

  return "NONE";
}

function isOrganizerOrStaff(role: ScanOperatorRole): boolean {
  return role === "ORGANIZER" || role === "STAFF";
}

/**
 * dispatch 层统一权限校验
 *
 * | action         | ORGANIZER | STAFF | EXHIBITOR              |
 * | CHECKIN        | ✅        | ✅    | ❌                     |
 * | STAMP          | ✅        | ✅    | ✅ 仅自己展位打卡点     |
 * | LOTTERY_VERIFY | ✅        | ✅    | ✅ 仅自己发起的抽奖     |
 * | GIFT_VERIFY    | ✅        | ✅    | ✅ 仅自己发起的         |
 */
export async function assertScanActionPermission(
  input: ActionPermissionInput,
): Promise<ScanHandlerOutcome | null> {
  const role = await resolveScanOperatorRole(input.operatorId, input.eventId);

  if (role === "NONE") {
    return {
      result: ScanResult.NO_PERMISSION,
      message: "无权执行此操作",
    };
  }

  switch (input.action) {
    case ScanActionType.CHECKIN:
      if (!isOrganizerOrStaff(role)) {
        return {
          result: ScanResult.NO_PERMISSION,
          message: "展商无权执行签到",
        };
      }
      return null;

    case ScanActionType.STAMP: {
      if (isOrganizerOrStaff(role)) {
        return null;
      }
      const stampId = input.actionRef?.trim();
      if (!stampId) {
        return {
          result: ScanResult.INVALID,
          message: "缺少打卡点 ID",
        };
      }
      const stamp = await prisma.stamp.findUnique({
        where: { id: stampId },
        select: { boothId: true, rally: { select: { eventId: true } } },
      });
      if (!stamp || stamp.rally.eventId !== input.eventId) {
        return {
          result: ScanResult.INVALID,
          message: "打卡点不存在",
        };
      }
      if (
        !stamp.boothId ||
        !(await hasBoothStaffAccess(
          input.operatorId,
          input.eventId,
          stamp.boothId,
        ))
      ) {
        return {
          result: ScanResult.NO_PERMISSION,
          message: "无权在此打卡点操作",
        };
      }
      return null;
    }

    case ScanActionType.LOTTERY_VERIFY:
    case ScanActionType.GIFT_VERIFY: {
      if (isOrganizerOrStaff(role)) {
        return null;
      }
      const winnerId = input.actionRef?.trim();
      if (!winnerId) {
        return null;
      }
      const winner = await prisma.lotteryWinner.findFirst({
        where: {
          id: winnerId,
          lottery: { eventId: input.eventId },
        },
        select: { lottery: { select: { boothId: true } } },
      });
      if (!winner) {
        return null;
      }
      const boothId = winner.lottery.boothId;
      if (
        !boothId ||
        !(await hasBoothStaffAccess(input.operatorId, input.eventId, boothId))
      ) {
        return {
          result: ScanResult.NO_PERMISSION,
          message: "无权核销该奖品",
        };
      }
      return null;
    }

    default:
      return {
        result: ScanResult.INVALID,
        message: "不支持的扫码动作",
      };
  }
}

/** 展商待核销列表：仅返回本展位发起的抽奖 */
export async function filterPendingPrizesForOperator(
  operatorId: string,
  eventId: string,
  prizes: Array<{ winnerId: string; lotteryBoothId: string | null }>,
): Promise<string[]> {
  const role = await resolveScanOperatorRole(operatorId, eventId);
  if (isOrganizerOrStaff(role)) {
    return prizes.map((p) => p.winnerId);
  }

  const allowed: string[] = [];
  for (const row of prizes) {
    if (
      row.lotteryBoothId &&
      (await hasBoothStaffAccess(operatorId, eventId, row.lotteryBoothId))
    ) {
      allowed.push(row.winnerId);
    }
  }
  return allowed;
}
