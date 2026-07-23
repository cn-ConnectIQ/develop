import { ErrorCode } from "@connectiq/types";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  assertBaigePartnerApiKey,
  BaigePartnerAuthError,
} from "@/lib/integrations/baige-partner-auth";
import {
  BaigeCheckinSyncError,
  ingestBaigeCheckin,
} from "@/lib/integrations/baige-checkin-sync";
import {
  BaigeStampSyncError,
  syncBaigeCollectionPoints,
} from "@/lib/integrations/baige-stamp-sync";

const checkinSchema = z.object({
  eventId: z.string().optional(),
  baigeEventId: z.string().optional(),
  phone: z.string().optional(),
  participantId: z.string().optional(),
  registrationId: z.string().optional(),
  checkedAt: z.string().optional(),
  baigeCheckinId: z.string().optional(),
});

const stampsSchema = z.object({
  eventId: z.string().optional(),
  baigeEventId: z.string().optional(),
  points: z
    .array(
      z.object({
        pointId: z.string().min(1),
        name: z.string().min(1),
        location: z.string().optional().nullable(),
        sortOrder: z.number().optional(),
        scanCode: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

type PartnerAuth =
  | {
      ok: true;
      mode: "session" | "partner";
      orgId: string | null;
      userId: string | null;
    }
  | { ok: false; response: NextResponse };

async function allowPartnerOrAdmin(request: NextRequest): Promise<PartnerAuth> {
  const admin = await requireAccountAdmin();
  if (!("error" in admin)) {
    return {
      ok: true,
      mode: "session",
      orgId: admin.orgId,
      userId: admin.session.user.id,
    };
  }
  try {
    assertBaigePartnerApiKey(request);
    return {
      ok: true,
      mode: "partner",
      orgId: null,
      userId: null,
    };
  } catch (error) {
    if (error instanceof BaigePartnerAuthError) {
      return {
        ok: false,
        response: createErrorResponse(
          error.message,
          ErrorCode.UNAUTHORIZED,
          error.status,
        ),
      };
    }
    throw error;
  }
}

export const POST = withErrorHandler(
  async (request): Promise<NextResponse> => {
    const auth = await allowPartnerOrAdmin(request);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") || "checkin";
    const body = await request.json().catch(() => null);

    if (kind === "stamps" || kind === "collection-points") {
      const parsed = stampsSchema.safeParse(body);
      if (!parsed.success) {
        return createErrorResponse(
          parsed.error.issues[0]?.message ?? "参数错误",
          ErrorCode.VALIDATION_ERROR,
          400,
        );
      }
      try {
        const result = await syncBaigeCollectionPoints({
          ...parsed.data,
          actorUserId: auth.userId,
        });
        return createSuccessResponse(result);
      } catch (error) {
        if (error instanceof BaigeStampSyncError) {
          return createErrorResponse(
            error.message,
            ErrorCode.VALIDATION_ERROR,
            400,
          );
        }
        throw error;
      }
    }

    const parsed = checkinSchema.safeParse(body);
    if (!parsed.success) {
      return createErrorResponse(
        parsed.error.issues[0]?.message ?? "参数错误",
        ErrorCode.VALIDATION_ERROR,
        400,
      );
    }
    try {
      const result = await ingestBaigeCheckin(parsed.data);
      return createSuccessResponse(result);
    } catch (error) {
      if (error instanceof BaigeCheckinSyncError) {
        return createErrorResponse(
          error.message,
          ErrorCode.VALIDATION_ERROR,
          400,
        );
      }
      throw error;
    }
  },
);
