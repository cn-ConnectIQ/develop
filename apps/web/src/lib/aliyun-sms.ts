import { createHash, createHmac, randomBytes } from "node:crypto";

export type AliyunSmsConfig = {
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
};

/** 兼容 ALIYUN_ACCESS_KEY_ID 与历史 ALIYUN_SMS_ACCESS_KEY */
export function resolveAliyunSmsConfig(
  templateEnv?: string,
): AliyunSmsConfig | null {
  const accessKeyId =
    process.env.ALIYUN_ACCESS_KEY_ID?.trim() ||
    process.env.ALIYUN_SMS_ACCESS_KEY?.trim() ||
    "";
  const accessKeySecret =
    process.env.ALIYUN_ACCESS_KEY_SECRET?.trim() ||
    process.env.ALIYUN_SMS_ACCESS_KEY_SECRET?.trim() ||
    "";
  const signName = process.env.ALIYUN_SMS_SIGN_NAME?.trim() || "";
  const templateCode =
    (templateEnv ? process.env[templateEnv]?.trim() : undefined) ||
    process.env.ALIYUN_SMS_TEMPLATE_CODE?.trim() ||
    "";

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    return null;
  }
  return { accessKeyId, accessKeySecret, signName, templateCode };
}

export function isAliyunSmsConfigured(templateEnv?: string): boolean {
  return resolveAliyunSmsConfig(templateEnv) !== null;
}

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
}

/** 阿里云 RPC 签名（SendSms） */
async function callSendSms(input: {
  cfg: AliyunSmsConfig;
  phone: string;
  templateCode: string;
  templateParam?: Record<string, string>;
}) {
  const params: Record<string, string> = {
    AccessKeyId: input.cfg.accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: input.phone,
    RegionId: "cn-hangzhou",
    SignName: input.cfg.signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomBytes(16).toString("hex"),
    SignatureVersion: "1.0",
    TemplateCode: input.templateCode,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  };
  if (input.templateParam) {
    params.TemplateParam = JSON.stringify(input.templateParam);
  }

  const canonicalized = Object.keys(params)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k]!)}`)
    .join("&");
  const stringToSign = `GET&${percentEncode("/")}&${percentEncode(canonicalized)}`;
  const signature = createHmac("sha1", `${input.cfg.accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  const query = `${canonicalized}&Signature=${percentEncode(signature)}`;
  const url = `https://dysmsapi.aliyuncs.com/?${query}`;
  const res = await fetch(url);
  const body = (await res.json()) as {
    Code?: string;
    Message?: string;
    BizId?: string;
    RequestId?: string;
  };
  return body;
}

export async function sendAliyunSms(input: {
  phone: string;
  templateParam?: Record<string, string>;
  templateCode?: string;
  templateEnv?: string;
}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
  dev?: boolean;
}> {
  const cfg = resolveAliyunSmsConfig(input.templateEnv);
  if (!cfg) {
    return {
      success: false,
      error:
        "短信未配置：需 ALIYUN_ACCESS_KEY_ID、ALIYUN_ACCESS_KEY_SECRET、ALIYUN_SMS_SIGN_NAME、ALIYUN_SMS_TEMPLATE_CODE",
    };
  }

  if (
    process.env.NODE_ENV === "development" &&
    process.env.FORCE_REAL_SMS !== "1"
  ) {
    console.info("[SMS DEV]", {
      phone: input.phone,
      template: input.templateCode ?? cfg.templateCode,
      param: input.templateParam,
    });
    return { success: true, messageId: `dev-sms-${Date.now()}`, dev: true };
  }

  try {
    const body = await callSendSms({
      cfg,
      phone: input.phone,
      templateCode: input.templateCode ?? cfg.templateCode,
      templateParam: input.templateParam,
    });
    if (body.Code === "OK") {
      return { success: true, messageId: body.BizId };
    }
    return {
      success: false,
      error: `${body.Code ?? "UNKNOWN"}: ${body.Message ?? "短信发送失败"}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "短信发送异常",
    };
  }
}

/** 配置探针（不用真发） */
export function hashAliyunSmsFingerprint() {
  const cfg = resolveAliyunSmsConfig();
  if (!cfg) return null;
  return createHash("sha256")
    .update(`${cfg.accessKeyId}:${cfg.signName}:${cfg.templateCode}`)
    .digest("hex")
    .slice(0, 12);
}
