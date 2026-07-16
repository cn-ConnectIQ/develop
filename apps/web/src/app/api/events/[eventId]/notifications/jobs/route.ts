import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { listNotificationJobs } from "@/lib/notification/job-service";
import { isPrismaSchemaDriftError } from "@/lib/prisma-errors";

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }
  await requireEventAccess(eventId);

  try {
    const jobs = await listNotificationJobs(eventId);
    return createSuccessResponse(jobs, { total: jobs.length });
  } catch (error) {
    if (isPrismaSchemaDriftError(error)) {
      return createErrorResponse(
        "通知模块数据表尚未就绪，请联系平台管理员执行通知 DDL",
        ErrorCode.INTERNAL_ERROR,
        503,
      );
    }
    throw error;
  }
});
