import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requirePlatformAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  listPlatformAdmins,
  PlatformAdminError,
  upsertPlatformAdmin,
} from "@/lib/platform-admin-service";

export const GET = withErrorHandler(async () => {
  await requirePlatformAdmin();
  const admins = await listPlatformAdmins();
  return createSuccessResponse({ admins, total: admins.length });
});

const createSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8).max(64).optional().nullable(),
});

export const POST = withErrorHandler(async (request) => {
  const auth = await requirePlatformAdmin();
  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse("参数错误", ErrorCode.VALIDATION_ERROR, 400);
  }

  try {
    const result = await upsertPlatformAdmin({
      ...parsed.data,
      actorUserId: auth.user.id,
    });
    return createSuccessResponse(result);
  } catch (e) {
    if (e instanceof PlatformAdminError) {
      const status =
        e.code === "CONFLICT"
          ? 409
          : e.code === "FORBIDDEN" || e.code === "LAST_ADMIN"
            ? 403
            : e.code === "NOT_FOUND"
              ? 404
              : 400;
      return createErrorResponse(e.message, ErrorCode.VALIDATION_ERROR, status);
    }
    throw e;
  }
});
