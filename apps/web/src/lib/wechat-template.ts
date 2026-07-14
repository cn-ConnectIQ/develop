import { getWxMpCredentials } from "@/lib/wechat/config";
import { withWxMpAccessToken } from "@/lib/wechat/mp-access-token";

export type SendWechatResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

/**
 * 发送服务号模板消息（微信公众平台 template/send）。
 * 需配置 WX_MP_APPID / WX_MP_SECRET；未配置时仅开发环境假成功。
 */
export async function sendWechatTemplate(params: {
  openId: string;
  templateId: string;
  data: Record<string, { value: string }>;
  url?: string;
}): Promise<SendWechatResult> {
  if (!params.openId?.trim()) {
    return { success: false, error: "缺少 OpenID" };
  }
  if (!params.templateId?.trim() || params.templateId === "default_invite") {
    return {
      success: false,
      error: "请配置有效的微信服务号模板 ID（WX_TMPL / 活动模板 ID）",
    };
  }

  const creds = getWxMpCredentials();
  if (!creds) {
    if (process.env.NODE_ENV === "development") {
      console.info("[WECHAT DEV]", params);
      return { success: true, messageId: `dev-wx-${Date.now()}` };
    }
    return {
      success: false,
      error: "微信服务号未配置（WX_MP_APPID / WX_MP_SECRET）",
    };
  }

  try {
    const body = await withWxMpAccessToken(async (accessToken) => {
      const res = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            touser: params.openId,
            template_id: params.templateId,
            url: params.url,
            data: params.data,
          }),
        },
      );
      return (await res.json()) as {
        errcode?: number;
        errmsg?: string;
        msgid?: number;
      };
    });

    if (body.errcode && body.errcode !== 0) {
      return {
        success: false,
        error: `${body.errcode}: ${body.errmsg ?? "微信模板发送失败"}`,
      };
    }

    return {
      success: true,
      messageId: body.msgid != null ? String(body.msgid) : undefined,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "微信模板发送异常",
    };
  }
}
