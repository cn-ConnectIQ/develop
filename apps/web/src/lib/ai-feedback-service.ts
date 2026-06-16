import { AiFeedbackType, prisma } from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";

export type SubmitAiFeedbackInput = {
  feedback_type: string;
  reference_table: "FEED_ITEM" | "AI_MATCH_RESULT";
  reference_id: string;
  reason_tags: string[];
  free_text?: string;
  feed_type?: string;
  mute_person_month?: boolean;
};

const FEEDBACK_TYPE_MAP: Record<string, AiFeedbackType> = {
  MATCH_USEFUL: AiFeedbackType.MATCH_USEFUL,
  MATCH_USELESS: AiFeedbackType.MATCH_USELESS,
  TIMING_ACCURATE: AiFeedbackType.TIMING_ACCURATE,
  TIMING_INACCURATE: AiFeedbackType.TIMING_INACCURATE,
  CONTENT_QUALITY: AiFeedbackType.CONTENT_QUALITY,
  CONTENT_POOR: AiFeedbackType.CONTENT_POOR,
};

function buildNegativeReason(input: SubmitAiFeedbackInput): string {
  return JSON.stringify({
    reference_table: input.reference_table,
    reference_id: input.reference_id,
    reason_tags: input.reason_tags,
    free_text: input.free_text ?? null,
    feed_type: input.feed_type ?? null,
    mute_person_month: input.mute_person_month ?? false,
  });
}

export async function submitAiFeedback(userId: string, input: SubmitAiFeedbackInput) {
  if (!input.reason_tags.length) {
    throw new ApiError("请选择反馈原因", ErrorCode.BAD_REQUEST, 400);
  }

  const type =
    FEEDBACK_TYPE_MAP[input.feedback_type] ?? AiFeedbackType.MATCH_USELESS;

  if (input.reference_table === "FEED_ITEM") {
    const feed = await prisma.feedItem.findFirst({
      where: { id: input.reference_id, userId },
      select: { id: true },
    });
    if (!feed) {
      throw new ApiError("动态不存在", ErrorCode.NOT_FOUND, 404);
    }
  }

  const record = await prisma.aiFeedback.create({
    data: {
      userId,
      type,
      positive: false,
      negativeReason: buildNegativeReason(input),
    },
  });

  return { id: record.id, ok: true };
}
