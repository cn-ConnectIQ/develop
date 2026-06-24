import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { exportMembersToMarketup } from "@/lib/org-member-service";

const bodySchema = z.object({
  user_ids: z.array(z.string()).min(1).max(100),
});

/** 批量导出用户池成员至 MarketUP CRM */
export const POST = withErrorHandler(async (request) => {
  const auth = await requireAccountAdmin(request);
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const result = await exportMembersToMarketup(
    auth.orgId,
    parsed.data.user_ids,
  );

  return createSuccessResponse(result);
});
