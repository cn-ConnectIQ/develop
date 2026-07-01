/**
 * TEST1377 主办方 AD API 冒烟（需 ACCOUNT_ADMIN 账号登录）
 */
const BASE_URL =
  process.env.SMOKE_BASE_URL ??
  "https://connectiq-web-git-develop-miloqians-projects.vercel.app";
const EVENT_ID = "cmqurkwkt001rzcpbzojv2mi4";
const PHONE = "13770626459";
const SMS_CODE = "888888";
const BOOTH_ID = "seed-m1377-booth-qian-test";

type Step = { name: string; ok: boolean; detail: string };

async function request(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // keep text
  }
  return { status: res.status, body };
}

function unwrap(body: unknown): unknown {
  if (body && typeof body === "object" && "data" in body) {
    return (body as { data: unknown }).data;
  }
  return body;
}

async function login(): Promise<string> {
  const { status, body } = await request("/api/auth/phone-login", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE, code: SMS_CODE, eventId: EVENT_ID }),
  });
  if (status !== 200) throw new Error(`登录失败 ${status}: ${JSON.stringify(body)}`);
  const data = unwrap(body) as { token?: string };
  if (!data.token) throw new Error("无 token");
  return data.token;
}

async function main() {
  const steps: Step[] = [];
  console.log(`\n🔍 TEST1377 主办方 AD 冒烟 @ ${BASE_URL}\n`);
  const token = await login();

  {
    const { status, body } = await request("/api/account/overview", { token });
    const d = unwrap(body) as Record<string, unknown>;
    steps.push({
      name: "AD1 overview",
      ok: status === 200 && Number(d.total_events ?? d.totalEvents) >= 1,
      detail: `HTTP ${status} events=${d.total_events ?? d.totalEvents}`,
    });
  }

  {
    const { status, body } = await request("/api/account/events", { token });
    const list = unwrap(body) as unknown[];
    const hit = Array.isArray(list)
      ? (list.find((e) => String((e as { id?: string }).id) === EVENT_ID) as
          | Record<string, unknown>
          | undefined)
      : undefined;
    steps.push({
      name: "AD1 events 快照",
      ok:
        status === 200 &&
        Boolean(hit) &&
        hit?.checkin_rate != null &&
        hit?.on_site != null &&
        hit?.connections != null,
      detail: hit
        ? `checkin=${hit.checkin_rate} on_site=${hit.on_site} conn=${hit.connections}`
        : `HTTP ${status}`,
    });
  }

  {
    const { status, body } = await request(
      `/api/account/events/${EVENT_ID}/manage-overview`,
      { token },
    );
    const d = unwrap(body) as Record<string, unknown>;
    const rankings = d.booth_rankings ?? d.boothRankings;
    const pending = d.pending_exhibitors ?? d.pendingExhibitors;
    steps.push({
      name: "AD3 manage-overview EXPO",
      ok:
        status === 200 &&
        String(d.kind).toUpperCase() === "EXPO" &&
        Array.isArray(rankings) &&
        (rankings as unknown[]).length > 0 &&
        Array.isArray(pending),
      detail: `HTTP ${status} rankings=${Array.isArray(rankings) ? rankings.length : 0} pending=${Array.isArray(pending) ? pending.length : 0}`,
    });
  }

  {
    const { status, body } = await request(
      `/api/account/events/${EVENT_ID}/exhibitor-reviews`,
      { token },
    );
    const list = unwrap(body);
    steps.push({
      name: "展商审核列表",
      ok: status === 200 && Array.isArray(list),
      detail: `HTTP ${status} count=${Array.isArray(list) ? list.length : 0}`,
    });
  }

  {
    const { status, body } = await request(
      `/api/account/events/${EVENT_ID}/stamp-monitor`,
      { token },
    );
    const d = unwrap(body) as Record<string, unknown>;
    steps.push({
      name: "集章监控",
      ok: status === 200 && Array.isArray(d.booths),
      detail: `HTTP ${status} booths=${Array.isArray(d.booths) ? d.booths.length : 0} rate=${d.completion_rate}`,
    });
  }

  {
    const { status, body } = await request(
      `/api/account/events/${EVENT_ID}/broadcast`,
      {
        method: "POST",
        token,
        body: JSON.stringify({
          title: "联调推送",
          body: "TEST1377 AD 冒烟测试",
        }),
      },
    );
    steps.push({
      name: "全场推送",
      ok: status === 200,
      detail: `HTTP ${status}`,
    });
  }

  {
    const { status, body } = await request(
      `/api/account/events/${EVENT_ID}/admin-lotteries`,
      { token },
    );
    const list = unwrap(body);
    steps.push({
      name: "抽奖列表",
      ok: status === 200 && Array.isArray(list),
      detail: `HTTP ${status} count=${Array.isArray(list) ? list.length : 0}`,
    });
  }

  let createdPollId = "";
  {
    const { status, body } = await request(`/api/events/${EVENT_ID}/polls`, {
      method: "POST",
      token,
      body: JSON.stringify({
        title: "【管理员发起】现场投票联调",
        type: "SINGLE_CHOICE",
        status: "LIVE",
        showResults: true,
        timeLimitMinutes: 30,
        options: ["选项 A", "选项 B", "选项 C"],
      }),
    });
    const d = unwrap(body) as Record<string, unknown>;
    createdPollId = String(d.id ?? "");
    steps.push({
      name: "POST 创建互动 polls",
      ok: status === 200 && Boolean(createdPollId),
      detail: `HTTP ${status} id=${createdPollId || "—"} type=${d.type}`,
    });
  }

  if (createdPollId) {
    const { status } = await request(
      `/api/events/${EVENT_ID}/polls/${createdPollId}`,
      {
        method: "PATCH",
        token,
        body: JSON.stringify({ status: "CLOSED" }),
      },
    );
    steps.push({
      name: "PATCH 结束互动 polls",
      ok: status === 200,
      detail: `HTTP ${status}`,
    });
  }

  {
    const { status, body } = await request(
      `/api/account/events/${EVENT_ID}/admin-leads`,
      { token },
    );
    const list = unwrap(body);
    steps.push({
      name: "线索列表",
      ok: status === 200 && Array.isArray(list),
      detail: `HTTP ${status} count=${Array.isArray(list) ? list.length : 0}`,
    });
  }

  let failed = 0;
  for (const s of steps) {
    console.log(`${s.ok ? "✅" : "❌"} ${s.name}: ${s.detail}`);
    if (!s.ok) failed += 1;
  }
  console.log(`\n${failed === 0 ? "全部通过" : `${failed} 项失败`}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
