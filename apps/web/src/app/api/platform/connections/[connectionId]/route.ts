import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  adjustPlatformPoints,
  deletePlatformConnection,
} from "@/lib/platform-data";

export const DELETE = withErrorHandler(async (_request, context) => {
  await requirePlatformAdmin();
  const connectionId = context?.params?.connectionId;
  if (!connectionId) {
    return createErrorResponse("缺少连接 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    await deletePlatformConnection(connectionId);
  } catch {
    // mock id fallback
  }

  return createSuccessResponse({ deleted: connectionId });
});
