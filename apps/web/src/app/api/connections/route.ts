import { ErrorCode } from "@connectiq/types";
import { ConnectionStatus, prisma } from "@connectiq/database";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import {
  createUserConnection,
  countActiveConnections,
  listActiveConnections,
} from "@/lib/connections-service";

const createConnectionSchema = z.object({
  target_user_id: z.string().cuid(),
  event_id: z.string().cuid().optional(),
});


export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? ConnectionStatus.ACTIVE;
  const limit = Number(searchParams.get("limit") ?? "30");

  if (status !== ConnectionStatus.ACTIVE) {
    return createErrorResponse("暂不支持该状态筛选", ErrorCode.VALIDATION_ERROR, 400);
  }

  const connections = await listActiveConnections(userId, limit);
  const total = await countActiveConnections(userId);

  return createSuccessResponse({ connections, total, count: total });
});

export const POST = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const connection = await createUserConnection(
    userId,
    parsed.data.target_user_id,
    parsed.data.event_id,
  );

  return createSuccessResponse({
    id: connection.id,
    status: connection.status,
    created_at: connection.createdAt.toISOString(),
  });
});
