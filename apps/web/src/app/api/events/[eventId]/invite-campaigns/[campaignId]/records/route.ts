import { InviteRecordStatus } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getCampaignForEvent,
  listInviteRecords,
} from "@/lib/invite/service";

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const campaignId = context?.params?.campaignId;

  if (!eventId || !campaignId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const campaign = await getCampaignForEvent(eventId, campaignId);
  if (!campaign) {
    return createErrorResponse("邀请活动不存在", ErrorCode.NOT_FOUND, 404);
  }

  const { searchParams } = new URL(request.url);
  const statusParam = searchParams.get("status");
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? 50)),
  );

  const statusGroup =
    statusParam === "success" ||
    statusParam === "failed" ||
    statusParam === "skipped"
      ? statusParam
      : undefined;

  const status =
    !statusGroup &&
    statusParam &&
    Object.values(InviteRecordStatus).includes(statusParam as InviteRecordStatus)
      ? (statusParam as InviteRecordStatus)
      : undefined;

  const { records, total } = await listInviteRecords(campaignId, {
    status,
    statusGroup,
    page,
    pageSize,
  });

  return createSuccessResponse(records, {
    total,
    page,
    hasNext: page * pageSize < total,
  });
});
