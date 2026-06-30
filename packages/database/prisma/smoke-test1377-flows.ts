/**
 * TEST1377 三项互动冒烟：投票 / 集章 / 展位抽奖
 * 用法：pnpm --filter @connectiq/database db:smoke-test1377
 */
const BASE_URL =
  process.env.SMOKE_BASE_URL ??
  "https://connectiq-web-git-develop-miloqians-projects.vercel.app";
const EVENT_ID = "cmqurkwkt001rzcpbzojv2mi4";
const PHONE = "13770626459";
const SMS_CODE = "888888";
const POLL_ID = "seed-m1377-poll-prize";
const BOOTH_LOTTERY_ID = "seed-m1377-booth-lottery-q";
const BOOTH_CODE = "T1377-Q";

type StepResult = { name: string; ok: boolean; detail: string };

async function request(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<{ status: number; body: unknown }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.token) headers.Authorization = `Bearer ${init.token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers,
  });
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
  if (status !== 200) {
    throw new Error(`登录失败 HTTP ${status}: ${JSON.stringify(body)}`);
  }
  const data = unwrap(body) as { token?: string };
  if (!data?.token) throw new Error("登录响应缺少 token");
  return data.token;
}

async function main() {
  const results: StepResult[] = [];
  console.log(`\n🔍 TEST1377 冒烟 @ ${BASE_URL}\n`);

  let token: string;
  try {
    token = await login();
    results.push({ name: "登录", ok: true, detail: PHONE });
  } catch (err) {
    console.error("❌ 无法登录，中止", err);
    process.exit(1);
  }

  // 1. 主页三项互动
  {
    const { status, body } = await request(
      `/api/events/${EVENT_ID}/dashboard-mobile`,
      { token },
    );
    const data = unwrap(body) as Record<string, unknown>;
    const live = Array.isArray(data?.liveInteractions)
      ? data.liveInteractions
      : [];
    const types = live.map((i) => String((i as { type?: string }).type ?? ""));
    const hasPoll = types.includes("POLL");
    const hasStamp = types.includes("STAMP");
    const hasLottery = types.includes("LOTTERY");
    results.push({
      name: "主页 liveInteractions",
      ok: status === 200 && hasPoll && hasStamp && hasLottery,
      detail: `HTTP ${status} types=[${types.join(",")}] count=${live.length}`,
    });
  }

  // 2. 有奖投票
  {
    const { status, body } = await request(
      `/api/events/${EVENT_ID}/polls/${POLL_ID}`,
      { token },
    );
    const poll = unwrap(body) as Record<string, unknown>;
    const options = Array.isArray(poll?.options) ? poll.options : [];
    const statusLive = String(poll?.status ?? "").toUpperCase() === "LIVE";
    results.push({
      name: "投票详情",
      ok: status === 200 && statusLive && options.length >= 2,
      detail: `HTTP ${status} status=${poll?.status} options=${options.length}`,
    });

    if (status === 200 && options.length > 0) {
      const optionId = String((options[0] as { id?: string }).id ?? "");
      const voted =
        poll?.has_voted === true || poll?.hasVoted === true;
      if (!voted && optionId) {
        const post = await request(
          `/api/events/${EVENT_ID}/polls/${POLL_ID}/respond`,
          {
            method: "POST",
            token,
            body: JSON.stringify({ option_id: optionId }),
          },
        );
        results.push({
          name: "投票提交",
          ok: post.status === 200,
          detail: `HTTP ${post.status}`,
        });
      } else {
        results.push({
          name: "投票提交",
          ok: true,
          detail: voted ? "已投过票，跳过" : "无选项",
        });
      }
    }
  }

  // 3. 展位列表集章/抽奖标记
  let boothId = "";
  {
    const { status, body } = await request(
      `/api/events/${EVENT_ID}/booths/public`,
    );
    const booths = unwrap(body) as Array<Record<string, unknown>>;
    const list = Array.isArray(booths) ? booths : [];
    const qBooth = list.find((b) => String(b.booth_code ?? b.code) === BOOTH_CODE);
    boothId = String(qBooth?.id ?? "");
    const stampOk = qBooth?.stamp_enabled === true || qBooth?.stampEnabled === true;
    const lotteryOk =
      qBooth?.has_lottery === true ||
      qBooth?.hasLottery === true ||
      Boolean(qBooth?.lottery_id ?? qBooth?.lotteryId);
    results.push({
      name: "展位列表标记",
      ok: status === 200 && Boolean(boothId) && stampOk && lotteryOk,
      detail: `HTTP ${status} booth=${BOOTH_CODE} stamp=${stampOk} lottery=${lotteryOk}`,
    });
  }

  // 4. 集章 passport + 打卡
  {
    const { status, body } = await request(
      `/api/events/${EVENT_ID}/stamp-passport`,
      { token },
    );
    const passport = unwrap(body) as Record<string, unknown>;
    const rallyIds = Array.isArray(passport?.rally_booth_ids)
      ? passport.rally_booth_ids
      : [];
    results.push({
      name: "集章护照",
      ok: status === 200 && Number(passport?.required_count) > 0,
      detail: `HTTP ${status} required=${passport?.required_count} rally_booths=${rallyIds.length}`,
    });

    if (boothId) {
      const stamp = await request(
        `/api/events/${EVENT_ID}/booths/${boothId}/stamp`,
        { method: "POST", token },
      );
      results.push({
        name: "展位集章打卡",
        ok: stamp.status === 200,
        detail: `HTTP ${stamp.status}`,
      });
    }
  }

  // 5. 展位即时抽奖
  if (boothId) {
    const { status, body } = await request(`/api/booths/${boothId}/lottery`, {
      method: "POST",
      token,
      body: JSON.stringify({
        name: "联调测试",
        phone: PHONE,
        company: "ConnectIQ",
      }),
    });
    const result = unwrap(body) as Record<string, unknown>;
    results.push({
      name: "展位抽奖",
      ok: status === 200 && typeof result?.won === "boolean",
      detail: `HTTP ${status} won=${result?.won} lottery_id=${result?.lottery_id ?? result?.lotteryId ?? BOOTH_LOTTERY_ID}`,
    });
  }

  console.log("结果：");
  let failed = 0;
  for (const r of results) {
    const icon = r.ok ? "✅" : "❌";
    if (!r.ok) failed += 1;
    console.log(`${icon} ${r.name}: ${r.detail}`);
  }
  console.log(`\n${failed === 0 ? "全部通过" : `${failed} 项失败`}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
