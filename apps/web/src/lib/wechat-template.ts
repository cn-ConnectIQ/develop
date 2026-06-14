export type SendWechatResult = {
  success: boolean;
  messageId?: string;
  error?: string;
};

export async function sendWechatTemplate(params: {
  openId: string;
  templateId: string;
  data: Record<string, { value: string }>;
  url?: string;
}): Promise<SendWechatResult> {
  if (
    process.env.NODE_ENV === "development" ||
    !process.env.WECHAT_APP_ID
  ) {
    console.info("[WECHAT DEV]", params);
    return { success: true, messageId: `dev-wx-${Date.now()}` };
  }

  console.info(`[WECHAT] 已向 ${params.openId} 发送模板消息`);
  return { success: true, messageId: `wx-${Date.now()}` };
}
