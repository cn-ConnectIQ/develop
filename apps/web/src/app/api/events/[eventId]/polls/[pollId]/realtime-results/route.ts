import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import { getPollRealtimeResults } from "@/lib/poll-realtime-results";

const SSE_INTERVAL_MS = 2000;

/** 投票实时结果（JSON 或 SSE） */
export const GET = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  const pollId = context?.params?.pollId;
  if (!eventId || !pollId) {
    return createErrorResponse("参数缺失", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const accept = request.headers.get("accept") ?? "";
  const stream =
    accept.includes("text/event-stream") ||
    new URL(request.url).searchParams.get("stream") === "sse";

  if (!stream) {
    const data = await getPollRealtimeResults(eventId, pollId);
    return createSuccessResponse(data);
  }

  const encoder = new TextEncoder();
  let closed = false;

  const streamBody = new ReadableStream({
    async start(controller) {
      const push = async () => {
        if (closed) return;
        try {
          const data = await getPollRealtimeResults(eventId, pollId);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ data })}\n\n`),
          );
        } catch (error) {
          console.error(error);
        }
      };

      await push();
      const timer = setInterval(push, SSE_INTERVAL_MS);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(timer);
        controller.close();
      });
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(streamBody, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
