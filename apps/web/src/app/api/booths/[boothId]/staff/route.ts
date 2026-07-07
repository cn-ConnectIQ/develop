import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  ApiError,
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  addBoothStaffMember,
  listBoothStaffMembers,
  requireBoothStaffOwner,
  requireBoothStaffViewer,
} from "@/lib/exhibitor/booth-staff-service";

const addStaffSchema = z.object({
  phone: z.string().min(1, "请输入手机号"),
  name: z.string().trim().max(64).optional(),
});

/** 展位团队成员列表 + 名额状态 */
export const GET = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const ctx = await requireBoothStaffViewer(request, boothId);
  const data = await listBoothStaffMembers(boothId);

  return createSuccessResponse({
    ...data,
    viewerIsOwner: ctx.viewerParticipant?.isBoothOwner ?? false,
  });
});

/** 添加展位团队成员（仅主账号） */
export const POST = withErrorHandler(async (request, context) => {
  const boothId = context?.params?.boothId;
  if (!boothId) {
    return createErrorResponse("缺少展位 ID", ErrorCode.VALIDATION_ERROR, 400);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = addStaffSchema.safeParse(body);
  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数错误",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const { userId } = await requireBoothStaffOwner(request, boothId);

  try {
    const { member } = await addBoothStaffMember(
      boothId,
      parsed.data,
      userId,
    );
    return createSuccessResponse({ added: true, member });
  } catch (err) {
    if (err instanceof ApiError) {
      return createErrorResponse(err.message, err.code, err.status);
    }
    throw err;
  }
});
