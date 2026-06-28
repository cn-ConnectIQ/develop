/**
 * 现场互动功能 API 联调脚本
 * 用法: BASE_URL=http://localhost:3000 tsx scripts/test-interactions-live.ts
 */
import "dotenv/config";
import { PollStatus } from "@prisma/client";
import { prisma } from "../src/client";
import { SEED_INT } from "../prisma/seed-interactions";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const MOBILE_PHONE = "13770626459";

type Result = { name: string; ok: boolean; status?: number; detail?: string; skip?: boolean };

const results: Result[] = [];

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail });
}

function skip(name: string, reason: string) {
  results.push({ name, ok: true, skip: true, detail: reason });
}

function miniToken(userId: string) {
  return `mini_${userId}_test`;
}

async function req(
  name: string,
  path: string,
  init: RequestInit & { authUserId?: string; expect?: number } = {},
) {
  const headers = new Headers(init.headers);
  if (init.authUserId) {
    headers.set("Authorization", `Bearer ${miniToken(init.authUserId)}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  try {
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    const expect = init.expect ?? 200;
    const text = await res.text();
    let detail = text.slice(0, 200);
    try {
      const json = JSON.parse(text) as { error?: string | { message?: string } };
      if (json.error) {
        detail =
          typeof json.error === "string"
            ? json.error
            : (json.error.message ?? detail);
      }
    } catch {
      /* keep raw */
    }
    const ok = res.status === expect || (expect === 200 && res.status >= 200 && res.status < 300);
    results.push({ name, ok, status: res.status, detail: ok ? undefined : detail });
    return { ok, status: res.status, text, detail };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, detail });
    return { ok: false, status: 0, text: "", detail };
  }
}

/** 已参与/重复提交视为幂等成功 */
function acceptIfAlreadyParticipated(
  name: string,
  res: { ok: boolean; status: number; detail?: string },
  suffix = "（已参与，幂等正常）",
) {
  if (!res.ok && res.detail?.includes("已参与")) {
    results[results.length - 1] = {
      name: `${name}${suffix}`,
      ok: true,
      status: res.status,
    };
  }
}

async function loadFixtures() {
  const user = await prisma.user.findFirst({
    where: { phone: MOBILE_PHONE },
    select: { id: true, name: true },
  });
  if (!user) throw new Error(`测试用户 ${MOBILE_PHONE} 不存在，请先 pnpm db:seed`);

  const event = await prisma.event.findFirst({
    where: { slug: "smart-link-industry-expo-2026" },
    select: { id: true, name: true },
  });
  if (!event) throw new Error("主测试活动不存在");

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { eventId: event.id },
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  const stampRally = await prisma.stampRally.findFirst({
    where: { eventId: event.id },
    select: { id: true, name: true },
  });

  const pollSingle = await prisma.poll.findUnique({
    where: { id: SEED_INT.hostedExpo.pollSingle },
    include: { options: { take: 1 } },
  });

  const pollMulti = await prisma.poll.findUnique({
    where: { id: SEED_INT.hostedExpo.pollMulti },
    include: { options: { take: 2 } },
  });

  const pollRating = await prisma.poll.findUnique({
    where: { id: SEED_INT.hostedExpo.pollRating },
  });

  const pollWordCloud = await prisma.poll.findUnique({
    where: { id: SEED_INT.hostedExpo.pollWordCloud },
  });

  const pollQna = await prisma.poll.findFirst({
    where: { eventId: event.id, type: "QNA", status: PollStatus.LIVE },
    select: { id: true },
  });

  const lotteryRandom = await prisma.lottery.findUnique({
    where: { id: SEED_INT.hostedExpo.lotteryRandom },
    select: { id: true, status: true },
  });

  const snSession = await prisma.snSession.findFirst({
    where: { eventId: event.id },
    select: { id: true },
  });

  return {
    user,
    event,
    booth,
    stampRally,
    pollSingle,
    pollMulti,
    pollRating,
    pollWordCloud,
    pollQna,
    lotteryRandom,
    snSession,
  };
}

async function main() {
  console.log(`\n🔗 BASE_URL = ${BASE}\n`);

  const health = await req("健康检查 GET /api/health", "/api/health");
  if (!health.ok) {
    console.error("服务不可用，请先启动 dev server: pnpm --filter @connectiq/web dev");
    process.exit(1);
  }

  const fx = await loadFixtures();
  const { user, event } = fx;
  const auth = user.id;
  const eid = event.id;

  console.log(`用户: ${user.name} (${MOBILE_PHONE})`);
  console.log(`活动: ${event.name}\n`);

  // ── 扫码 Session ──
  await req("扫码 Session GET /api/i/SEED01", "/api/i/SEED01");
  await req("扫码 Session GET /api/i/SEED02", "/api/i/SEED02");
  await req("扫码 Session GET /api/i/SEEDB1", "/api/i/SEEDB1");
  await req("扫码 Session GET /api/i/SEEDS1", "/api/i/SEEDS1");

  if (fx.pollSingle?.options[0]) {
    const r = await req(
      "扫码参与 单选投票 POST /api/i/SEED01/participate",
      "/api/i/SEED01/participate",
      {
        method: "POST",
        authUserId: auth,
        body: JSON.stringify({
          user_id: auth,
          poll_response: {
            poll_id: fx.pollSingle.id,
            option_id: fx.pollSingle.options[0].id,
          },
        }),
        expect: 200,
      },
    );
    acceptIfAlreadyParticipated("扫码参与 单选投票 POST /api/i/SEED01/participate", r);
  }

  // ── Poll 各类型 ──
  if (fx.pollSingle?.options[0]) {
    const r = await req(
      "单选投票 respond",
      `/api/events/${eid}/polls/${fx.pollSingle.id}/respond`,
      {
        method: "POST",
        authUserId: auth,
        body: JSON.stringify({ option_id: fx.pollSingle.options[0].id }),
      },
    );
    acceptIfAlreadyParticipated("单选投票 respond", r);
  }

  if (fx.pollMulti?.options.length) {
    const r = await req(
      "多选投票 respond",
      `/api/events/${eid}/polls/${fx.pollMulti.id}/respond`,
      {
        method: "POST",
        authUserId: auth,
        body: JSON.stringify({
          option_ids: fx.pollMulti.options.map((o) => o.id),
        }),
      },
    );
    acceptIfAlreadyParticipated("多选投票 respond", r);
  }

  if (fx.pollRating) {
    const r = await req(
      "评分投票 respond",
      `/api/events/${eid}/polls/${fx.pollRating.id}/respond`,
      {
        method: "POST",
        authUserId: auth,
        body: JSON.stringify({ rating: 5 }),
      },
    );
    acceptIfAlreadyParticipated("评分投票 respond", r);
  }

  if (fx.pollWordCloud) {
    await req(
      "词云 respond",
      `/api/events/${eid}/polls/${fx.pollWordCloud.id}/respond`,
      {
        method: "POST",
        authUserId: auth,
        body: JSON.stringify({ text_answer: `联调测试-${Date.now()}` }),
      },
    );
  }

  // ── Q&A ──
  await req("Q&A 列表 GET /api/events/{id}/qna", `/api/events/${eid}/qna`, {
    authUserId: auth,
  });

  if (fx.pollQna) {
    const r = await req(
      "Q&A 提问 POST",
      `/api/events/${eid}/qna`,
      {
        method: "POST",
        authUserId: auth,
        body: JSON.stringify({
          poll_id: fx.pollQna.id,
          question: `联调提问 ${new Date().toLocaleTimeString()}`,
        }),
      },
    );
    acceptIfAlreadyParticipated("Q&A 提问 POST", r);
  }

  // ── 抽奖 ──
  if (fx.lotteryRandom) {
    const enter = await req(
      "抽奖报名 enter",
      `/api/events/${eid}/lotteries/${fx.lotteryRandom.id}/enter`,
      { method: "POST", authUserId: auth, expect: 200 },
    );
    if (!enter.ok && enter.detail?.includes("已参与")) {
      results[results.length - 1] = {
        name: "抽奖报名 enter（已参与，幂等正常）",
        ok: true,
        status: enter.status,
      };
    }
    skip("抽奖列表 GET lotteries", "主办方 Web session 鉴权");
  }

  // ── 签到 / 展位（POST 仅支持 booth_id） ──
  if (fx.booth) {
    await req(
      "展位签到 POST checkin(booth)",
      `/api/events/${eid}/checkin`,
      {
        method: "POST",
        authUserId: auth,
        body: JSON.stringify({ booth_id: fx.booth.id }),
      },
    );
  }

  // ── 集章 ──
  if (fx.stampRally) {
    await req(
      "集章进度 GET my-progress",
      `/api/events/${eid}/stamp-rallies/${fx.stampRally.id}/my-progress`,
      { authUserId: auth },
    );
    if (fx.booth) {
      await req(
        "集章打卡 POST stamp",
        `/api/events/${eid}/stamp-rallies/${fx.stampRally.id}/stamp`,
        {
          method: "POST",
          authUserId: auth,
          body: JSON.stringify({ booth_id: fx.booth.id }),
          expect: 200,
        },
      );
    }
  }

  // ── 线索 ──
  if (fx.booth) {
    await req(
      "线索采集 POST leads",
      `/api/events/${eid}/leads`,
      {
        method: "POST",
        authUserId: auth,
        body: JSON.stringify({
          booth_id: fx.booth.id,
          intent_level: "B",
        }),
        expect: 200,
      },
    );
  }

  // ── 连接 / 交换 ──
  await req("我的连接 GET my-connections", `/api/events/${eid}/my-connections`, {
    authUserId: auth,
  });
  await req("连接列表 GET /api/connections", "/api/connections", {
    authUserId: auth,
  });
  await req("交换请求 GET exchange-requests", "/api/me/exchange-requests", {
    authUserId: auth,
  });

  // ── Speed Networking ──
  await req("SN 状态 GET sn/status", `/api/events/${eid}/sn/status`, {
    authUserId: auth,
  });
  if (fx.snSession) {
    await req(
      "SN 历史 GET sn-pairs/my-history",
      `/api/events/${eid}/sn-pairs/my-history`,
      { authUserId: auth },
    );
  }

  // ── 配对 / AI ──
  await req("意向 GET my-intent", `/api/events/${eid}/my-intent`, {
    authUserId: auth,
  });
  await req(
    "AI 匹配预览 GET match-preview",
    `/api/users/me/match-preview?eventId=${eid}`,
    { authUserId: auth },
  );
  const boothRoute = await req(
    "AI 逛展路线 GET booth-route",
    `/api/events/${eid}/ai/booth-route`,
    { authUserId: auth },
  );
  if (!boothRoute.ok && boothRoute.detail?.includes("未开启")) {
    results[results.length - 1] = {
      name: "AI 逛展路线 GET booth-route（feature 未开）",
      ok: true,
      skip: true,
      detail: boothRoute.detail,
    };
  }

  skip("AI 引荐 GET scan-referrals", "主办方 Web session 鉴权");

  // ── 会面 ──
  await req("我的会面 GET /api/me/meetings", "/api/me/meetings", {
    authUserId: auth,
  });
  await req(
    "会面时段 GET meeting-time-slots",
    `/api/events/${eid}/meeting-time-slots`,
    { authUserId: auth },
  );

  // ── 积分 / Feed ──
  await req("积分 GET /api/users/me/points", "/api/users/me/points", {
    authUserId: auth,
  });
  await req("动态 Feed GET /api/feed", "/api/feed", { authUserId: auth });

  skip("大屏当前 GET bigscreen/current", "主办方 Web session 鉴权");
  skip("实时统计 GET live-stats", "主办方 Web session 鉴权");
  skip("Live Ops GET live-ops", "主办方 Web session 鉴权");
  skip("展位排行 GET booth-rankings", "主办方 Web session 鉴权");

  // ── 活动摘要（移动端首页） ──
  await req(
    "活动摘要 GET my-summary",
    `/api/events/${eid}/my-summary`,
    { authUserId: auth },
  );

  // ── 汇总 ──
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log("\n══════════════════════════════════════");
  console.log(`  现场互动联调: ${passed}/${results.length} 通过`);
  console.log("══════════════════════════════════════\n");

  for (const r of results) {
    const icon = r.ok ? (r.skip ? "○" : "✓") : "✗";
    const status = r.status ? ` [${r.status}]` : "";
    const suffix = r.detail ? ` — ${r.detail}` : "";
    console.log(`${icon} ${r.name}${status}${suffix}`);
  }

  if (failed.length) {
    console.log(`\n⚠ ${failed.length} 项失败`);
    process.exit(1);
  }
  console.log("\n✅ 全部通过");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
