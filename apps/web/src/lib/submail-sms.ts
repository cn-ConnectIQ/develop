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
  const signName =
    process.env.SUBMAIL_SIGN_NAME?.trim() ||
    process.env.ALIYUN_SMS_SIGN_NAME?.trim() ||
    "玖莅";
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
function buildSignature(
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
    const timestamp = await fetchSubmailTimestamp(cfg.endpoint);
    const form: Record<string, string> = {
      appid: cfg.appId,
      to: input.phone.trim(),
      content: buildContent(input.signName ?? cfg.signName, input.content),
      timestamp,
      sign_type: "md5",
    };
    if (input.tag) form.tag = input.tag;
    form.signature = buildSignature(cfg.appId, cfg.appKey, form);

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
      const error =
        payload?.msg ||
        payload?.message ||
        payload?.error ||
        `Submail HTTP ${res.status}`;
      console.error("[SUBMAIL]", error, payload);
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
    const timestamp = await fetchSubmailTimestamp(cfg.endpoint);
    const form: Record<string, string> = {
      appid: cfg.appId,
      to: input.phone.trim(),
      project: input.project,
      timestamp,
      sign_type: "md5",
    };
    if (input.vars && Object.keys(input.vars).length) {
      form.vars = JSON.stringify(input.vars);
    }
    if (input.tag) form.tag = input.tag;
    form.signature = buildSignature(cfg.appId, cfg.appKey, form);

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
    } | null;

    const ok =
      payload?.status === "success" ||
      payload?.status === "ok" ||
      payload?.code === 0;
    if (!ok) {
      return {
        success: false,
        error: payload?.msg || payload?.message || `Submail XSend HTTP ${res.status}`,
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
