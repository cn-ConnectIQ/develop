import { prisma, PollStatus, PollType } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { assertAttendeeReadableEvent } from "@/lib/public-event-access";
import { requireMobileEventAccess } from "@/lib/mobile-user-id";
import {
  resolvePollListStatusFilter,
  serializePollForMobile,
} from "@/lib/poll-mobile-api";

const createPollSchema = z
  .object({
    title: z.string().min(1).max(200),
    type: z
      .string()
      .superRefine((val, ctx) => {
        if (val === "LOTTERY") {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message:
              "抽奖请使用 POST /api/events/{eventId}/lotteries 或 GET /api/account/events/{eventId}/admin-lotteries",
          });
          return;
        }
        if (!Object.values(PollType).includes(val as PollType)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `type 须为 ${Object.values(PollType).join(" | ")}`,
          });
        }
      })
      .transform((val) => val as PollType),
    options: z.array(z.string().min(1)).optional(),
    status: z.nativeEnum(PollStatus).optional(),
    showResults: z.boolean().optional(),
    closesAt: z.string().datetime().optional(),
    timeLimitMinutes: z.number().min(1).max(1440).optional(),
    scheduledAt: z.string().datetime().optional(),
    publishAfterMinutes: z.number().min(1).max(1440).optional(),
  })
  .superRefine((data, ctx) => {
    const choiceTypes: PollType[] = [
      PollType.SINGLE_CHOICE,
      PollType.MULTI_CHOICE,
      PollType.SURVEY,
    ];
    if (
      choiceTypes.includes(data.type) &&
      data.status === PollStatus.LIVE &&
      (!data.options || data.options.length < 2)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "单选/多选/问卷发布时需至少 2 个选项",
        path: ["options"],
      });
    }
  });

export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await assertAttendeeReadableEvent(eventId);

  const url = new URL(request.url);
  const typeFilter = url.searchParams.get("type");
  const statusFilter = resolvePollListStatusFilter(
    url.searchParams.get("status"),
    url.searchParams.get("scope"),
  );

  const [polls, sessions] = await Promise.all([
    prisma.poll.findMany({
      where: {
        eventId,
        ...(typeFilter ? { type: typeFilter as PollType } : {}),
        ...(statusFilter ? { status: { in: statusFilter } } : {}),
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

  return createSuccessResponse({
    polls: polls.map((poll) => serializePollForMobile(poll, eventId)),
    sessions,
  }, { total: polls.length });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const { userId } = await requireMobileEventAccess(request, eventId);
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

  if (status === PollStatus.LIVE) {
    await prisma.poll.updateMany({
      where: { eventId, status: PollStatus.LIVE },
      data: { status: PollStatus.PAUSED },
    });
  }

  const poll = await prisma.poll.create({
    data: {
      eventId,
      createdById: userId,
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

  return createSuccessResponse(serializePollForMobile(poll, eventId));
});
