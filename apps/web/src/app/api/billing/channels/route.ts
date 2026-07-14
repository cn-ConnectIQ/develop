import { getAlipayConfigStatus } from "@/lib/billing/alipay";
import { getWechatPayConfigStatus } from "@/lib/billing/wechat-pay";
import {
  ApiError,
  createSuccessResponse,
  requireAccountAdmin,
  withErrorHandler,
} from "@/lib/api-auth";
import { ErrorCode } from "@connectiq/types";

/** 支付渠道配置状态（不含密钥明文） */
export const GET = withErrorHandler(async () => {
  const result = await requireAccountAdmin();
  if ("error" in result) {
    const status = result.error.status;
    throw new ApiError(
      status === 401 ? "未登录" : "无权访问",
      status === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.FORBIDDEN,
      status,
    );
  }

  return createSuccessResponse({
    alipay: getAlipayConfigStatus(),
    wechat: getWechatPayConfigStatus(),
  });
});
