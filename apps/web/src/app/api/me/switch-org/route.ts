import {
  AdminStatus,
  AccountType,
  InviteStatus,
  OrgStaffRole,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  forbidden,
  requireAuthSession,
  unauthorized,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveOrgHomeRoute } from "@/lib/org-home-route";
import { ORG_MULTI_SWITCH_ENABLED } from "@/lib/org-switcher-utils";

const bodySchema = z.object({
  orgId: z.string().min(1),
});

export const POST = withErrorHandler(async (request) => {
  const session = await requireAuthSession();
  if (!session) return unauthorized();

  if (session.user.userType !== "ACCOUNT_ADMIN") {
    return forbidden("仅账号管理员可切换组织");
  }

  if (!ORG_MULTI_SWITCH_ENABLED) {
    return createErrorResponse(
      "当前账号模型不支持组织切换",
      ErrorCode.FORBIDDEN,
      403,
    );
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { orgId } = parsed.data;

  const staff = await prisma.orgStaff.findFirst({
    where: {
      userId: session.user.id,
      orgId,
      role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
      status: InviteStatus.ACCEPTED,
    },
    include: {
      org: {
        select: {
          id: true,
          accountType: true,
          adminStatus: true,
        },
      },
    },
  });

  if (!staff) {
    return forbidden("无权切换到该组织");
  }

  if (staff.org.adminStatus !== AdminStatus.APPROVED) {
    return createErrorResponse(
      "该组织尚未审核通过，无法切换",
      ErrorCode.FORBIDDEN,
      403,
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { orgId },
  });

  const redirectPath = await resolveOrgHomeRoute(
    orgId,
    staff.org.accountType ?? AccountType.ORGANIZATION,
  );

  return createSuccessResponse({
    activeOrgId: staff.org.id,
    activeOrgType: staff.org.accountType,
    activeAdminStatus: staff.org.adminStatus,
    redirectPath,
    message: "切换成功",
  });
});
