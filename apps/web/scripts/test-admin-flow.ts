/**
 * 管理端首页起点的端到端冒烟测试
 * 运行：cd packages/database && npx tsx ../../apps/web/scripts/test-admin-flow.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envPath = resolve(import.meta.dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

import { prisma } from "@connectiq/database";

const BASE = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
const EMAIL = "organizer1@connectiq.test";
const PASSWORD = "ConnectIQ2024!";

type Check = { name: string; ok: boolean; detail?: string };
const checks: Check[] = [];

function pass(name: string, detail?: string) {
  checks.push({ name, ok: true, detail });
  console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail?: string) {
  checks.push({ name, ok: false, detail });
  console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

class CookieJar {
  private cookies = new Map<string, string>();

  store(res: Response) {
    const raw = res.headers.getSetCookie?.() ?? [];
    for (const c of raw) {
      const part = c.split(";")[0];
      const eq = part.indexOf("=");
      if (eq > 0) this.cookies.set(part.slice(0, eq), part.slice(eq + 1));
    }
    const single = res.headers.get("set-cookie");
    if (single && raw.length === 0) {
      const part = single.split(";")[0];
      const eq = part.indexOf("=");
      if (eq > 0) this.cookies.set(part.slice(0, eq), part.slice(eq + 1));
    }
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
}

async function login(jar: CookieJar) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: jar.header() ? { Cookie: jar.header() } : {},
  });
  jar.store(csrfRes);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken,
      email: EMAIL,
      password: PASSWORD,
      redirect: "false",
      json: "true",
    }),
    redirect: "manual",
  });
  jar.store(loginRes);
  const text = await loginRes.text();
  try {
    const body = JSON.parse(text);
    return loginRes.ok || !!body?.url;
  } catch {
    return loginRes.status === 302 || loginRes.ok;
  }
}

async function getPage(
  jar: CookieJar,
  path: string,
  label: string,
  expectText?: string,
) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: jar.header() },
    redirect: "follow",
  });
  const html = await res.text();
  const ok =
    res.ok &&
    !html.includes('"statusCode":500') &&
    !html.includes("Application error") &&
    (!expectText || html.includes(expectText) || res.ok);
  ok
    ? pass(label, `HTTP ${res.status}`)
    : fail(label, `HTTP ${res.status}${expectText && !html.includes(expectText) ? `，缺少「${expectText}」` : ""}`);
  return { ok, html, status: res.status };
}

async function getApi(jar: CookieJar, path: string, label: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Cookie: jar.header() },
  });
  const json = await res.json().catch(() => null);
  const ok = res.ok && json?.data !== undefined;
  ok
    ? pass(label, `HTTP ${res.status}`)
    : fail(label, `HTTP ${res.status} ${json?.error ?? ""}`);
  return { ok, json };
}

async function main() {
  console.log("ConnectIQ 管理端冒烟测试（从首页登录开始）\n");

  const event = await prisma.event.findUnique({
    where: { slug: "saas-growth-summit-2025" },
    select: { id: true, name: true },
  });
  if (!event) throw new Error("未找到 seed 活动，请先 pnpm db:seed");

  const campaign = await prisma.inviteCampaign.findFirst({
    where: { eventId: event.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`  账号: ${EMAIL}`);
  console.log(`  活动: ${event.name} (${event.id})\n`);

  const jar = new CookieJar();

  console.log("[0] 登录");
  const loggedIn = await login(jar);
  loggedIn ? pass("邮箱登录", EMAIL) : fail("邮箱登录", "认证失败");

  const sessionRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { Cookie: jar.header() },
  });
  jar.store(sessionRes);
  const session = await sessionRes.json();
  if (session?.user?.email) {
    pass("Session 有效", `${session.user.role} · ${session.user.email}`);
  } else {
    fail("Session 有效", "无 session");
  }

  console.log("\n[1] 管理端首页 & 导航");
  await getPage(jar, "/", "GET / 重定向", "ConnectIQ");
  await getPage(jar, "/events", "活动列表 /events", "ConnectIQ");
  await getPage(jar, `/events/${event.id}`, "活动工作台", event.name.slice(0, 4));

  console.log("\n[2] 参会者 & 邀请管理");
  await getPage(jar, `/events/${event.id}/participants`, "名单管理", "名单管理");
  await getPage(
    jar,
    `/events/${event.id}/participants`,
    "名单管理 · 邀请按钮",
    "邀请加入 ConnectIQ",
  );
  await getPage(jar, `/events/${event.id}/invite-campaigns`, "邀请管理", "邀请管理");

  if (campaign) {
    await getPage(
      jar,
      `/events/${event.id}/invite-campaigns/${campaign.id}`,
      "邀请活动详情",
      campaign.name.slice(0, 4),
    );
    await getApi(
      jar,
      `/api/events/${event.id}/invite-campaigns/${campaign.id}/progress`,
      "Progress API",
    );
    await getApi(
      jar,
      `/api/events/${event.id}/invite-campaigns/${campaign.id}/records?status=all`,
      "Records API",
    );
  } else {
    console.log("  ⚠ 无邀请活动，跳过详情页 API 测试");
  }

  console.log("\n[3] 关联 API");
  await getApi(jar, `/api/events/${event.id}/dashboard`, "Dashboard API");
  await getApi(
    jar,
    `/api/events/${event.id}/participants?limit=5`,
    "Participants API",
  );
  await getApi(jar, `/api/events/${event.id}/invite-campaigns`, "Campaigns API");

  console.log("\n── 汇总 ──");
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`通过 ${passed} / 失败 ${failed} / 共 ${checks.length}`);

  if (failed === 0) {
    console.log("\n浏览器手动验证：");
    console.log(`  1. 打开 ${BASE}/login 登录 ${EMAIL}`);
    console.log(`  2. 进入 ${BASE}/events/${event.id}/participants`);
    console.log(`  3. 点击「邀请加入 ConnectIQ」→ 创建/发送`);
    console.log(`  4. 进入 ${BASE}/events/${event.id}/invite-campaigns`);
  }

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n测试异常:", err);
  void prisma.$disconnect();
  process.exit(1);
});
