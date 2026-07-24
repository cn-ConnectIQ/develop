import { ErrorCode } from "@connectiq/types";
import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import {
  getOrCreateContactCard,
  updateContactCard,
} from "@/lib/contact-card-service";
import { resolveMobileUserId } from "@/lib/mobile-user-id";

const patchBodySchema = z.object({
  wechat_qr_url: z.string().optional().nullable(),
  wechat_id: z.string().max(64).optional().nullable(),
  show_phone: z.boolean().optional(),
  show_email: z.boolean().optional(),
  // 空字符串按未填处理，避免 show_email=true 且未填邮箱时整包 PATCH 失败
  email: z
    .union([z.string().email(), z.literal('')])
    .optional()
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  allow_exchange: z.boolean().optional(),
  auto_accept_at_event: z.boolean().optional(),
  headline: z.string().max(200).optional().nullable(),
  card_theme: z.string().max(32).optional(),
});

export const GET = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const card = await getOrCreateContactCard(userId);
  return createSuccessResponse(card);
});

export const PATCH = withErrorHandler(async (request) => {
  const userId = await resolveMobileUserId(request);
  const body = await request.json().catch(() => ({}));
  const parsed = patchBodySchema.safeParse(body);

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "参数校验失败",
      ErrorCode.VALIDATION_ERROR,
      400,
    );
  }

  const data = parsed.data;
  const card = await updateContactCard(userId, {
    wechatQrUrl: data.wechat_qr_url,
    wechatId: data.wechat_id,
    showPhone: data.show_phone,
    showEmail: data.show_email,
    email: data.email,
    allowExchange: data.allow_exchange,
    autoAcceptAtEvent: data.auto_accept_at_event,
    headline: data.headline,
    cardTheme: data.card_theme,
  });

  return createSuccessResponse(card);
});
