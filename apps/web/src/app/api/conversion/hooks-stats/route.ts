import { UserRole } from "@connectiq/types";
import {
  createSuccessResponse,
  requireAuth,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { getConversionHooksStats } from "@/lib/conversion-hook-service";

/** 转化钩子漏斗统计（平台全量或当前组织） */
export const GET = withErrorHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

  if (scope === "platform") {
    await requireAuth([UserRole.PLATFORM_ADMIN]);
    const stats = await getConversionHooksStats(null);
    return createSuccessResponse(stats);
  }

  const auth = await requireAccountAdmin();
  if ("error" in auth) return auth.error;

  const stats = await getConversionHooksStats(auth.orgId);
  return createSuccessResponse(stats);
});
