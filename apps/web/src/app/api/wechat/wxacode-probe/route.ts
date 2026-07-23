import { ErrorCode } from "@connectiq/types";
import {
  createErrorResponse,
  createSuccessResponse,
  withErrorHandler,
} from "@/lib/api-auth";
import { INVITE_ENTRY_MINI_PAGE } from "@/lib/invite/entry-service";
import {
  getWxMiniCredentials,
  getWxMiniProgramState,
} from "@/lib/wechat/config";
import { generateUnlimitedWxacode } from "@/lib/wechat/wxacode";

/**
 * 探测 WX_MINI_* 是否可生成小程序码（不回传密钥）。
 * GET /api/wechat/wxacode-probe?kind=home|invite|interaction
 */
export const GET = withErrorHandler(async (request) => {
  const creds = getWxMiniCredentials();
  if (!creds) {
    return createErrorResponse(
      "未配置 WX_MINI_APPID / WX_MINI_SECRET",
      ErrorCode.VALIDATION_ERROR,
      503,
    );
  }

  const kind =
    new URL(request.url).searchParams.get("kind")?.trim() || "home";

  try {
    let scene = "home";
    let page = "";
    if (kind === "invite") {
      scene = "t_probeWxacodeTok12";
      page = INVITE_ENTRY_MINI_PAGE;
    } else if (kind === "interaction") {
      scene = "i_PROBE1";
      page = "";
    }

    const code = await generateUnlimitedWxacode({
      scene,
      page,
      width: 280,
      asDataUrl: true,
    });

    return createSuccessResponse({
      ok: true,
      kind,
      appIdPrefix: creds.appId.slice(0, 6),
      programState: getWxMiniProgramState(),
      scene: code.scene,
      page: code.page || "(home)",
      bytes: code.buffer.length,
      /** 完整 data URL，便于本地保存验看 */
      dataUrl: code.dataUrl,
    });
  } catch (err) {
    return createErrorResponse(
      err instanceof Error ? err.message : "生成失败",
      ErrorCode.INTERNAL_ERROR,
      502,
    );
  }
});
