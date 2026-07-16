import { createHash } from "node:crypto";

const DEFAULT_ENDPOINT = "https://api-v4.mysubmail.com";

export type SubmailConfig = {
  appId: string;
  appKey: string;
  /** 签名名（不含【】），如 玖莅 */
  signName: string;
  endpoint: string;
};

export type SmsSendResult = {
  success: boolean;
  messageId?: string;
  error?: string;
  dev?: boolean;
  provider?: "submail" | "aliyun" | "dev";
};

export function getSubmailConfig(): SubmailConfig | null {
  const appId =
    process.env.SUBMAIL_APP_ID?.trim() ||
    process.env.SUBMAIL_APPID?.trim() ||
    "";
  const appKey =
    process.env.SUBMAIL_APP_KEY?.trim() ||
    process.env.SUBMAIL_APPKEY?.trim() ||
    "";
  // 勿默认猜签名；猜错会触发赛邮 126「签名未报备」
  const signName =
    process.env.SUBMAIL_SIGN_NAME?.trim() ||
    process.env.ALIYUN_SMS_SIGN_NAME?.trim() ||
    "";
  if (!appId || !appKey) return null;
  return {
    appId,
    appKey,
    signName,
    endpoint: (
      process.env.SUBMAIL_ENDPOINT?.trim() || DEFAULT_ENDPOINT
    ).replace(/\/$/, ""),
  };
}

export function isSubmailConfigured(): boolean {
  return getSubmailConfig() !== null;
}

function normalizeSign(sign: string) {
  const s = sign.trim().replace(/^【+/, "").replace(/】+$/, "");
  return s ? `【${s}】` : "";
}

function buildContent(signName: string, content: string) {
  const sign = normalizeSign(signName);
  const body = content.trim();
  if (!sign) return body;
  if (body.includes(sign) || body.startsWith("【")) return body;
  return `${sign}${body}`;
}

async function fetchSubmailTimestamp(endpoint: string): Promise<string> {
  try {
    const res = await fetch(`${endpoint}/service/timestamp`);
    const data = (await res.json()) as {
      timestamp?: string | number;
      data?: { timestamp?: string | number };
    };
    const ts = data.timestamp ?? data.data?.timestamp;
    if (ts != null && String(ts)) return String(ts);
  } catch {
    // ignore
  }
  return String(Math.floor(Date.now() / 1000));
}

/**
 * SUBMAIL 数字签名（md5）：
 * signature = md5(appid + appkey + (k=v&...) + appid + appkey)
 * tag 不参与签名。
 */
function buildMd5Signature(
  appId: string,
  appKey: string,
  params: Record<string, string>,
) {
  const keys = Object.keys(params)
    .filter((k) => k !== "signature" && k.toLowerCase() !== "tag")
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
  const kv = keys.map((k) => `${k}=${params[k] ?? ""}`).join("&");
  const raw = `${appId}${appKey}${kv}${appId}${appKey}`;
  return createHash("md5").update(raw).digest("hex");
}

/** 默认 normal：与赛邮官方示例 / 多数现网项目一致（signature=appkey） */
function applyApiAuth(
  cfg: SubmailConfig,
  form: Record<string, string>,
): Record<string, string> {
  const mode = (
    process.env.SUBMAIL_SIGN_TYPE?.trim().toLowerCase() || "normal"
  ) as "normal" | "md5" | "sha1";
  if (mode === "md5") {
    form.timestamp = form.timestamp || String(Math.floor(Date.now() / 1000));
    form.sign_type = "md5";
    // v2：content 不参与加密，避免中文正文导致验签失败
    form.sign_version = "2";
    form.signature = buildMd5Signature(cfg.appId, cfg.appKey, form);
    return form;
  }
  form.sign_type = "normal";
  form.signature = cfg.appKey;
  return form;
}

function extractLeadingSign(content: string): string | null {
  const m = content.trim().match(/^【([^】]+)】/);
  return m?.[1] ? m[1] : null;
}

/** 失败时回显正文：验证码数字打码，便于核对签名/模板 */
function maskSmsContent(content: string): string {
  return content.replace(/\d{4,8}/g, "******");
}

function mapSubmailError(
  payload: {
    code?: number | string;
    msg?: string;
    message?: string;
    error?: string;
  } | null,
  httpStatus: number,
  content?: string | null,
): string {
  const code = payload?.code != null ? String(payload.code) : "";
  const raw =
    payload?.msg ||
    payload?.message ||
    payload?.error ||
    `Submail HTTP ${httpStatus}`;
  const usedSign = content ? extractLeadingSign(content) : null;
  const preview = content ? maskSmsContent(content) : "";
  const meta = [
    usedSign ? `实际签名：【${usedSign}】` : null,
    preview ? `正文：${preview}` : null,
  ]
    .filter(Boolean)
    .join("；");
  const prefix = meta ? `${meta}。` : "";

  if (code === "126" || /Signature not reported/i.test(raw)) {
    return `${prefix}短信签名未完成运营商报备（赛邮错误126）。赛邮失败记录通常不展示正文；请以这里的「实际签名/正文」为准。`;
  }
  if (code === "113" || /IP/i.test(raw)) {
    return `${prefix}请求 IP 不在赛邮白名单（错误113）。`;
  }
  return prefix ? `${prefix}${raw}` : raw;
}

/**
 * SMS/Send：按正文发送（赛邮会自动审模板）。
 * @see https://www.mysubmail.com/documents/LJ4xa2
 */
export async function sendSubmailSms(input: {
  phone: string;
  /** 不含签名的正文，或已含【签名】的完整内容 */
  content: string;
  /** 回传标签，Webhook 的 tag 字段 */
  tag?: string;
  signName?: string;
}): Promise<SmsSendResult> {
  const cfg = getSubmailConfig();
  if (!cfg) {
    return {
      success: false,
      error: "短信未配置：需 SUBMAIL_APP_ID / SUBMAIL_APP_KEY",
      provider: "submail",
    };
  }

  if (
    process.env.NODE_ENV === "development" &&
    process.env.FORCE_REAL_SMS !== "1"
  ) {
    console.info("[SMS DEV submail]", {
      phone: input.phone,
      content: buildContent(input.signName ?? cfg.signName, input.content),
      tag: input.tag,
    });
    return {
      success: true,
      messageId: `dev-submail-${Date.now()}`,
      dev: true,
      provider: "dev",
    };
  }

  try {
    const content = buildContent(input.signName ?? cfg.signName, input.content);
    if (!content.includes("【")) {
      return {
        success: false,
        error:
          "短信内容缺少签名：请配置 SUBMAIL_SIGN_NAME（如 南京弟齐信息，不要带【】）",
        provider: "submail",
      };
    }

    const form: Record<string, string> = {
      appid: cfg.appId,
      to: input.phone.trim(),
      content,
    };
    // md5 模式需要时间戳；normal 可省略
    if ((process.env.SUBMAIL_SIGN_TYPE?.trim().toLowerCase() || "normal") === "md5") {
      form.timestamp = await fetchSubmailTimestamp(cfg.endpoint);
    }
    if (input.tag) form.tag = input.tag;
    applyApiAuth(cfg, form);

    const body = new URLSearchParams(form);
    const res = await fetch(`${cfg.endpoint}/sms/send.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const payload = (await res.json().catch(() => null)) as {
      status?: string;
      code?: number;
      send_id?: string;
      message_id?: string;
      id?: string;
      msg?: string;
      message?: string;
      error?: string;
    } | null;

    const ok =
      payload?.status === "success" ||
      payload?.status === "ok" ||
      payload?.code === 0;

    if (!ok) {
      const usedSign = extractLeadingSign(content);
      const error = mapSubmailError(payload, res.status, content);
      console.error("[SUBMAIL]", error, {
        appid: cfg.appId,
        signName: cfg.signName,
        usedSign,
        content: maskSmsContent(content),
        payload,
      });
      return { success: false, error, provider: "submail" };
    }

    const messageId =
      payload?.send_id || payload?.message_id || payload?.id || undefined;
    console.info(`[SUBMAIL] Sent to ${input.phone} id=${messageId ?? "?"}`);
    return { success: true, messageId, provider: "submail" };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Submail 发送异常",
      provider: "submail",
    };
  }
}

/**
 * SMS/XSend：模板变量发送（可选）。
 * 需在赛邮后台创建 project（模板 ID）。
 */
export async function sendSubmailXSend(input: {
  phone: string;
  project: string;
  vars?: Record<string, string>;
  tag?: string;
}): Promise<SmsSendResult> {
  const cfg = getSubmailConfig();
  if (!cfg) {
    return {
      success: false,
      error: "短信未配置：需 SUBMAIL_APP_ID / SUBMAIL_APP_KEY",
      provider: "submail",
    };
  }

  if (
    process.env.NODE_ENV === "development" &&
    process.env.FORCE_REAL_SMS !== "1"
  ) {
    console.info("[SMS DEV submail xsend]", input);
    return {
      success: true,
      messageId: `dev-submail-x-${Date.now()}`,
      dev: true,
      provider: "dev",
    };
  }

  try {
    const form: Record<string, string> = {
      appid: cfg.appId,
      to: input.phone.trim(),
      project: input.project,
    };
    if ((process.env.SUBMAIL_SIGN_TYPE?.trim().toLowerCase() || "normal") === "md5") {
      form.timestamp = await fetchSubmailTimestamp(cfg.endpoint);
    }
    if (input.vars && Object.keys(input.vars).length) {
      form.vars = JSON.stringify(input.vars);
    }
    if (input.tag) form.tag = input.tag;
    applyApiAuth(cfg, form);

    const res = await fetch(`${cfg.endpoint}/sms/xsend.json`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(form),
    });
    const payload = (await res.json().catch(() => null)) as {
      status?: string;
      code?: number;
      send_id?: string;
      msg?: string;
      message?: string;
      error?: string;
    } | null;

    const ok =
      payload?.status === "success" ||
      payload?.status === "ok" ||
      payload?.code === 0;
    if (!ok) {
      return {
        success: false,
        error: mapSubmailError(payload, res.status),
        provider: "submail",
      };
    }
    return {
      success: true,
      messageId: payload?.send_id,
      provider: "submail",
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Submail XSend 异常",
      provider: "submail",
    };
  }
}
