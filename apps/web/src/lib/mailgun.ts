export type MailgunSendResult = {
  sent: boolean;
  dev: boolean;
  messageId?: string;
  error?: string;
};

type MailgunConfig = {
  apiKey: string;
  domain: string;
  from: string;
  region: "us" | "eu";
};

function stripEnvQuotes(value: string | undefined) {
  if (!value) return undefined;
  return value.replace(/^["']|["']$/g, "").trim();
}

function normalizeFromAddress(from: string) {
  return from.replace(/^([^<]+?)(<)/, (_, name, bracket) => `${name.trim()} ${bracket}`);
}

export function getMailgunConfig(): MailgunConfig | null {
  const apiKey = stripEnvQuotes(process.env.MAILGUN_API_KEY);
  const domain = stripEnvQuotes(process.env.MAILGUN_DOMAIN);
  if (!apiKey || !domain) return null;

  const regionRaw = stripEnvQuotes(process.env.MAILGUN_REGION)?.toLowerCase();
  const region = regionRaw === "eu" ? "eu" : "us";
  const from =
    normalizeFromAddress(
      stripEnvQuotes(process.env.MAILGUN_FROM) ??
        `玖莅 <noreply@${domain}>`,
    );

  return { apiKey, domain, from, region };
}

function getMailgunApiBase(region: "us" | "eu") {
  return region === "eu"
    ? "https://api.eu.mailgun.net"
    : "https://api.mailgun.net";
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function plainTextToHtml(text: string) {
  return text
    .split("\n")
    .map((line) => `<p>${line ? escapeHtml(line) : "&nbsp;"}</p>`)
    .join("");
}

export async function sendMailViaMailgun(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** 自定义变量，Webhook 会原样回传（如 invite_record_id） */
  variables?: Record<string, string>;
  tags?: string[];
}): Promise<MailgunSendResult> {
  const config = getMailgunConfig();
  if (!config) {
    console.info(
      `[EMAIL DEV] To: ${params.to}\nSubject: ${params.subject}\n${params.text}`,
    );
    return { sent: true, dev: true, messageId: `dev-mail-${Date.now()}` };
  }

  const url = `${getMailgunApiBase(config.region)}/v3/${config.domain}/messages`;
  const body = new URLSearchParams({
    from: config.from,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html ?? plainTextToHtml(params.text),
  });
  if (params.variables) {
    for (const [key, value] of Object.entries(params.variables)) {
      if (value) body.append(`v:${key}`, value);
    }
  }
  if (params.tags?.length) {
    for (const tag of params.tags) {
      if (tag) body.append("o:tag", tag);
    }
  }

  const auth = Buffer.from(`api:${config.apiKey}`).toString("base64");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const payload = (await response.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;

    if (!response.ok) {
      const error =
        payload?.message ??
        `Mailgun HTTP ${response.status}: ${response.statusText}`;
      console.error("[MAILGUN]", error);
      return { sent: false, dev: false, error };
    }

    console.info(`[MAILGUN] Sent to ${params.to} id=${payload?.id ?? "unknown"}`);
    return { sent: true, dev: false, messageId: payload?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Mailgun 请求失败";
    console.error("[MAILGUN]", message);
    return { sent: false, dev: false, error: message };
  }
}
