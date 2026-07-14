import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  confirmJobCompliance,
  dispatchNotificationJob,
  getJobAnalytics,
  sendJobSampleTest,
} from "@/lib/notification/job-service";
import { prisma } from "@connectiq/database";

async function loadCtx(eventId: string, jobId: string) {
  const { session } = await requireEventAccess(eventId);
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  if (!event) return null;
  const job = await prisma.notificationJob.findFirst({
    where: { id: jobId, eventId },
  });
  if (!job) return null;
  return { session, orgId: event.orgId, job };
}

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  const jobId = context?.params?.jobId;
  if (!eventId || !jobId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }
  const ctx = await loadCtx(eventId, jobId);
  if (!ctx) {
    return createErrorResponse("任务不存在", ErrorCode.NOT_FOUND, 404);
  }
  const analytics = await getJobAnalytics(jobId, eventId);
  return createSuccessResponse({ job: ctx.job, analytics });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const jobId = context?.params?.jobId;
  if (!eventId || !jobId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }
  const ctx = await loadCtx(eventId, jobId);
  if (!ctx) {
    return createErrorResponse("任务不存在", ErrorCode.NOT_FOUND, 404);
  }

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  if (action === "compliance") {
    const job = await confirmJobCompliance({
      jobId,
      eventId,
      orgId: ctx.orgId,
      userId: ctx.session.user.id,
    });
    return createSuccessResponse({ job });
  }

  if (action === "sample-test") {
    const result = await sendJobSampleTest({
      jobId,
      eventId,
      orgId: ctx.orgId,
      operatorUserId: ctx.session.user.id,
    });
    return createSuccessResponse({ result });
  }

  if (action === "send") {
    const result = await dispatchNotificationJob({
      jobId,
      eventId,
      orgId: ctx.orgId,
    });
    return createSuccessResponse(result);
  }

  return createErrorResponse(
    "action 须为 compliance | sample-test | send",
    ErrorCode.VALIDATION_ERROR,
    400,
  );
});
