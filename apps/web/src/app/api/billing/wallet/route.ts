import { ErrorCode } from "@connectiq/types";
import {
  ApiError,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { getOrgWalletBalances } from "@/lib/billing/wallet-service";
import { prisma } from "@connectiq/database";

async function requireBillingAdmin() {
  const result = await requireAccountAdmin();
  if ("error" in result) {
    const status = result.error.status;
    throw new ApiError(
      status === 401 ? "未登录" : "无权访问",
      status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN,
      status,
    );
  }
  return result;
}

/** 组织钱包余额 + 近期流水 */
export const GET = withErrorHandler(async () => {
  const { orgId } = await requireBillingAdmin();
  const balances = await getOrgWalletBalances(orgId);
  const ledgers = await prisma.billingLedger.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return createSuccessResponse({ balances, ledgers });
});
