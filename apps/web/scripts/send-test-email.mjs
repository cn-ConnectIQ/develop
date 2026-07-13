/**
 * Mailgun 联调：读取 apps/web/.env.local 并发一封测试邮件
 * 用法: node apps/web/scripts/send-test-email.mjs [收件人]
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvFile(path) {
  try {
    const text = readFileSync(path, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

const root = resolve(__dirname, "../../..");
loadEnvFile(resolve(root, "apps/web/.env.local"));

const apiKey = process.env.MAILGUN_API_KEY?.replace(/^["']|["']$/g, "").trim();
const domain = process.env.MAILGUN_DOMAIN?.replace(/^["']|["']$/g, "").trim();
const fromRaw =
  process.env.MAILGUN_FROM?.replace(/^["']|["']$/g, "").trim() ||
  `玖莅 <noreply@${domain}>`;
const from = fromRaw.replace(/^([^<]+?)(<)/, (_, name, bracket) => `${name.trim()} ${bracket}`);
const region =
  process.env.MAILGUN_REGION?.replace(/^["']|["']$/g, "").trim().toLowerCase() ===
  "eu"
    ? "eu"
    : "us";
const to = process.argv[2] || "qiandonghui@gmail.com";

if (!apiKey || !domain) {
  console.error("MAILGUN 未配置：请检查 MAILGUN_API_KEY / MAILGUN_DOMAIN");
  process.exit(1);
}

console.log("Mailgun config:", {
  domain,
  from,
  region,
  apiKeyPrefix: `${apiKey.slice(0, 8)}…`,
  to,
});

const base =
  region === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net";
const url = `${base}/v3/${domain}/messages`;
const body = new URLSearchParams({
  from,
  to,
  subject: "玖莅 Mailgun 联调测试",
  text: `您好，

这是一封来自玖莅的 Mailgun 联调测试邮件。

若你收到此信，说明邮件发送通道已打通。

发送时间：${new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}

玖莅 团队`,
});

const auth = Buffer.from(`api:${apiKey}`).toString("base64");
const response = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Basic ${auth}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body,
});

const payload = await response.json().catch(() => null);
console.log("HTTP", response.status, payload);
process.exit(response.ok ? 0 : 1);
