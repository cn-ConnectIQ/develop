import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireEventAccess,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  parseFieldMap,
  parseSyncConfig,
  upsertExternalSync,
} from "@/lib/external-sync";

const postSchema = z.object({
  fieldMap: z.record(z.string()).optional(),
  syncConfig: z
    .object({
      writeStrategy: z.enum(["create_only", "upsert"]).optional(),
      conflictPolicy: z.enum(["connectiq", "marketup"]).optional(),
      triggers: z
        .object({
          welcomeEmail: z.boolean().optional(),
          assignSalesOnA: z.boolean().optional(),
          nurtureOnEnd: z.boolean().optional(),
        })
        .optional(),
    })
    .optional(),
});

export const GET = withErrorHandler(async (_request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);

  const { getExternalSync } = await import("@/lib/external-sync");
  const sync = await getExternalSync(eventId);

  return createSuccessResponse({
    fieldMap: parseFieldMap(sync.fieldMap),
    syncConfig: parseSyncConfig(sync.syncConfig),
  });
});

export const POST = withErrorHandler(async (request, context) => {
  const eventId = context?.params?.eventId;
  if (!eventId) {
    return createErrorResponse("缺少活动 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  await requireEventAccess(eventId);
  const body = await request.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  const updated = await upsertExternalSync(eventId, {
    ...(parsed.data.fieldMap !== undefined && { fieldMap: parsed.data.fieldMap }),
    ...(parsed.data.syncConfig !== undefined && {
      syncConfig: parseSyncConfig(parsed.data.syncConfig),
    }),
  });

  return createSuccessResponse({
    fieldMap: parseFieldMap(updated.fieldMap),
    syncConfig: parseSyncConfig(updated.syncConfig),
  });
});
