import { prisma, PollStatus, PollType } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";

const createPollSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.nativeEnum(PollType),
  options: z.array(z.string().min(1)).optional(),
  status: z.nativeEnum(PollStatus).optional(),
  showResults: z.boolean().optional(),
  closesAt: z.string().datetime().optional(),
  timeLimitMinutes: z.number().optional(),
  scheduledAt: z.string().datetime().optional(),
  publishAfterMinutes: z.number().min(1).max(1440).optional(),
});

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertAttendeeReadableEvent(eventId);

  const typeFilter = new URL(request.url).searchParams.get("type");
  const statusFilter = new URL(request.url).searchParams.get("status");

  const [polls, sessions] = await Promise.all([
    prisma.poll.findMany({
      where: {
        eventId,
        ...(typeFilter ? { type: typeFilter as PollType } : {}),
        ...(statusFilter ? { status: statusFilter as PollStatus } : {}),
      },
      orderBy: [
        { status: "asc" },
        { displayOrder: "asc" },
        { createdAt: "desc" },
      ],
      include: {
        options: { orderBy: { displayOrder: "asc" } },
        _count: { select: { responses: true } },
      },
    }),
    prisma.session.findMany({
      where: { eventId },
      select: { id: true, title: true },
      orderBy: { startTime: "asc" },
    }),
  ]);

  return createSuccessResponse({ polls, sessions }, { total: polls.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { session } = await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = createPollSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const status = parsed.data.status ?? PollStatus.DRAFT;
  const scheduledAt = parsed.data.scheduledAt
    ? new Date(parsed.data.scheduledAt)
    : parsed.data.publishAfterMinutes && status === PollStatus.DRAFT
      ? new Date(Date.now() + parsed.data.publishAfterMinutes * 60 * 1000)
      : undefined;

  const closesAt = parsed.data.closesAt
    ? new Date(parsed.data.closesAt)
    : parsed.data.timeLimitMinutes && status === PollStatus.LIVE
      ? new Date(Date.now() + parsed.data.timeLimitMinutes * 60 * 1000)
      : undefined;

  const poll = await prisma.poll.create({
    data: {
      eventId,
      createdById: session.user.id,
      title: parsed.data.title,
      type: parsed.data.type,
      status,
      showResults: parsed.data.showResults ?? true,
      closesAt,
      scheduledAt,
      options: parsed.data.options?.length
        ? {
            create: parsed.data.options.map((text, index) => ({
              text,
              displayOrder: index,
            })),
          }
        : undefined,
    },
    include: {
      options: { orderBy: { displayOrder: "asc" } },
      _count: { select: { responses: true } },
    },
  });

  return createSuccessResponse(poll);
});
