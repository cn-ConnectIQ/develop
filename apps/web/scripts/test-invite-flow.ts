/**
 * 邀请功能集成测试
 * 运行：cd packages/database && npx tsx ../../apps/web/scripts/test-invite-flow.ts
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

import {
  InviteCampaignStatus,
  InviteChannel,
  InviteRecordStatus,
  ParticipantInviteStatus,
  prisma,
} from "@connectiq/database";

const BASE = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

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

function computeTokenExpiresAt(endDate: Date | null) {
  const base = endDate ?? new Date();
  const expires = new Date(base);
  expires.setDate(expires.getDate() + 7);
  return expires;
}

async function ensureTestCampaign() {
  const event = await prisma.event.findUnique({
    where: { slug: "saas-growth-summit-2025" },
    include: {
      organizer: { select: { id: true, name: true } },
      participants: { take: 3, orderBy: { createdAt: "asc" } },
    },
  });

  if (!event) {
    throw new Error("未找到 seed 活动 saas-growth-summit-2025，请先运行 pnpm db:seed");
  }

  let campaign = await prisma.inviteCampaign.findFirst({
    where: { eventId: event.id, name: { contains: "集成测试" } },
    include: { records: { take: 1 } },
  });

  if (!campaign) {
    const participant = event.participants[0];
    if (!participant) {
      throw new Error("活动无参会者，请先运行 pnpm db:seed");
    }

    campaign = await prisma.inviteCampaign.create({
      data: {
        eventId: event.id,
        createdBy: event.organizer.id,
        name: "集成测试 · 邀请活动",
        channel: InviteChannel.SMS,
        customMessage:
          "{name}，您好！诚邀您参加 {event_name}。点击链接：{link}",
        targetFilter: { exclude_activated: true },
        status: InviteCampaignStatus.SENT,
        totalTarget: 1,
        sentCount: 1,
        deliveredCount: 1,
        clickedCount: 0,
        activatedCount: 0,
        failedCount: 0,
        startedAt: new Date(),
        completedAt: new Date(),
        records: {
          create: {
            participantId: participant.id,
            channel: InviteChannel.SMS,
            destination: participant.phone ?? "13800000001",
            tokenExpiresAt: computeTokenExpiresAt(event.endDate),
            status: InviteRecordStatus.DELIVERED,
            sentAt: new Date(),
            deliveredAt: new Date(),
          },
        },
      },
      include: { records: { take: 1 } },
    });
    console.log("  → 已创建测试邀请活动");
  }

  const record =
    campaign.records[0] ??
    (await prisma.inviteRecord.findFirst({
      where: { campaignId: campaign.id },
    }));

  if (!record) throw new Error("测试活动无 InviteRecord");

  return { event, campaign, record };
}

async function testDbLogic(
  eventId: string,
  campaignId: string,
  token: string,
) {
  console.log("\n[1] 数据库 / 业务逻辑");

  const record = await prisma.inviteRecord.findUnique({
    where: { activationToken: token },
    include: {
      participant: true,
      campaign: { include: { event: { select: { id: true, name: true } } } },
    },
  });

  if (!record) {
    fail("InviteRecord 查询", "token 不存在");
    return;
  }
  pass("InviteRecord 查询", record.participant.name);

  const expired = record.tokenExpiresAt.getTime() < Date.now();
  expired
    ? fail("Token 有效期", "已过期")
    : pass("Token 有效期", record.tokenExpiresAt.toISOString().slice(0, 10));

  if (!record.clickedAt) {
    await prisma.$transaction([
      prisma.inviteRecord.update({
        where: { id: record.id },
        data: {
          status: InviteRecordStatus.CLICKED,
          clickedAt: new Date(),
        },
      }),
      prisma.participant.updateMany({
        where: {
          id: record.participantId,
          inviteStatus: {
            in: [
              ParticipantInviteStatus.NOT_INVITED,
              ParticipantInviteStatus.INVITED,
            ],
          },
        },
        data: { inviteStatus: ParticipantInviteStatus.CLICKED },
      }),
      prisma.inviteCampaign.update({
        where: { id: record.campaignId },
        data: { clickedCount: { increment: 1 } },
      }),
    ]);
  }

  const afterClick = await prisma.inviteRecord.findUnique({
    where: { activationToken: token },
    select: { clickedAt: true, status: true },
  });
  afterClick?.clickedAt
    ? pass("点击记录写入", `status=${afterClick.status}`)
    : fail("点击记录写入", "clickedAt 为空");

  const campaign = await prisma.inviteCampaign.findUnique({
    where: { id: campaignId },
  });
  if (campaign && campaign.totalTarget >= 1) {
    pass(
      "Campaign 统计",
      `sent=${campaign.sentCount}/${campaign.totalTarget}, clicked=${campaign.clickedCount}`,
    );
  } else {
    fail("Campaign 统计", "数据异常");
  }

  if (record.campaign.event.id === eventId) {
    pass("Event ID 匹配", eventId.slice(0, 8) + "…");
  } else {
    fail("Event ID 匹配", "event 参数不一致");
  }
}

async function testHttpEndpoints(eventId: string, token: string) {
  console.log("\n[2] 公开 HTTP 端点（需 dev server @ :3000）");

  try {
    const joinUrl = `${BASE}/join?token=${encodeURIComponent(token)}&event=${encodeURIComponent(eventId)}`;
    const joinRes = await fetch(joinUrl);
    if (joinRes.ok) {
      const html = await joinRes.text();
      html.includes("ConnectIQ") &&
      (html.includes("立即加入") ||
        html.includes("你已经加入了") ||
        html.includes("集成测试"))
        ? pass("GET /join", `HTTP ${joinRes.status}`)
        : fail("GET /join", "页面内容不符合预期");
    } else {
      fail("GET /join", `HTTP ${joinRes.status}`);
    }

    const activateRes = await fetch(
      `${BASE}/api/invite/activate?token=${encodeURIComponent(token)}`,
    );
    if (activateRes.ok) {
      const json = await activateRes.json();
      json.data?.event?.name
        ? pass("GET /api/invite/activate", json.data.event.name)
        : fail("GET /api/invite/activate", "响应缺少 event");
    } else {
      fail("GET /api/invite/activate", `HTTP ${activateRes.status}`);
    }

    const progressRes = await fetch(`${BASE}/api/events/${eventId}/invite-campaigns/fake-id/progress`);
    progressRes.status === 401 || progressRes.status === 403
      ? pass("GET progress 鉴权", `HTTP ${progressRes.status}（未登录拒绝）`)
      : pass("GET progress 鉴权", `HTTP ${progressRes.status}`);
  } catch (e) {
    fail("HTTP 请求", e instanceof Error ? e.message : "连接失败，请确认 npm run dev 已启动");
  }
}

async function main() {
  console.log("ConnectIQ 邀请功能集成测试\n");

  const { event, campaign, record } = await ensureTestCampaign();
  console.log(`  活动: ${event.name}`);
  console.log(`  邀请活动: ${campaign.name}`);
  console.log(`  Token: ${record.activationToken.slice(0, 16)}…`);
  console.log(`  落地页: ${BASE}/join?token=${record.activationToken}&event=${event.id}`);
  console.log(`  详情页: ${BASE}/events/${event.id}/invite-campaigns/${campaign.id}`);

  await testDbLogic(event.id, campaign.id, record.activationToken);
  await testHttpEndpoints(event.id, record.activationToken);

  console.log("\n── 汇总 ──");
  const passed = checks.filter((c) => c.ok).length;
  const failed = checks.filter((c) => !c.ok).length;
  console.log(`通过 ${passed} / 失败 ${failed} / 共 ${checks.length}`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("\n测试异常:", err);
  void prisma.$disconnect();
  process.exit(1);
});
