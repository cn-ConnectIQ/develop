/**
 * 直连 DB 校验 TEST1377 三项互动数据
 * 用法：pnpm --filter @connectiq/database db:verify-test1377
 */
import {
  EventStatus,
  LotteryStatus,
  PollStatus,
  StampRallyStatus,
} from "@prisma/client";
import { prisma } from "../src/client";

const EVENT_ID = "cmqurkwkt001rzcpbzojv2mi4";
const POLL_ID = "seed-m1377-poll-prize";
const BOOTH_LOTTERY_ID = "seed-m1377-booth-lottery-q";
const BOOTH_CODE = "T1377-Q";

async function main() {
  const event = await prisma.event.findUnique({
    where: { id: EVENT_ID },
    select: { id: true, name: true, status: true, featureFlags: true },
  });
  if (!event) throw new Error("活动不存在");

  const poll = await prisma.poll.findFirst({
    where: { id: POLL_ID, eventId: EVENT_ID },
    include: { options: true },
  });

  const rally = await prisma.stampRally.findFirst({
    where: { eventId: EVENT_ID, status: StampRallyStatus.ACTIVE },
    orderBy: { createdAt: "desc" },
  });

  const booth = await prisma.exhibitorBooth.findFirst({
    where: { eventId: EVENT_ID, code: BOOTH_CODE },
    select: { id: true, code: true, name: true },
  });

  const boothLottery = await prisma.lottery.findFirst({
    where: { id: BOOTH_LOTTERY_ID, eventId: EVENT_ID },
    select: { id: true, status: true, boothId: true },
  });

  const flags =
    event.featureFlags && typeof event.featureFlags === "object"
      ? (event.featureFlags as Record<string, boolean>)
      : {};

  const checks = [
    {
      name: "活动 LIVE",
      ok: event.status === EventStatus.LIVE,
      detail: event.status,
    },
    {
      name: "功能开关 stampRally + lottery",
      ok: flags.stampRally === true && flags.lottery === true,
      detail: JSON.stringify({ stampRally: flags.stampRally, lottery: flags.lottery }),
    },
    {
      name: "有奖投票 LIVE + 选项",
      ok:
        poll?.status === PollStatus.LIVE &&
        (poll?.options.length ?? 0) >= 2,
      detail: poll
        ? `${poll.status} options=${poll.options.length}`
        : "poll missing",
    },
    {
      name: "集章路线 ACTIVE + 展位",
      ok: Boolean(rally) && (rally?.boothIds.length ?? 0) >= 3,
      detail: rally
        ? `${rally.status} booths=${rally.boothIds.length}`
        : "rally missing",
    },
    {
      name: "T1377-Q 展位存在",
      ok: Boolean(booth),
      detail: booth ? `${booth.code} id=${booth.id}` : "missing",
    },
    {
      name: "展位抽奖 OPEN",
      ok:
        boothLottery?.status === LotteryStatus.OPEN &&
        boothLottery.boothId === booth?.id,
      detail: boothLottery
        ? `${boothLottery.status} boothId=${boothLottery.boothId}`
        : "missing",
    },
    {
      name: "集章含 T1377-Q",
      ok: Boolean(booth && rally?.boothIds.includes(booth.id)),
      detail: booth && rally ? rally.boothIds.includes(booth.id) : false,
    },
  ];

  console.log(`\n📦 TEST1377 数据校验 (${event.name})\n`);
  let failed = 0;
  for (const c of checks) {
    console.log(`${c.ok ? "✅" : "❌"} ${c.name}: ${c.detail}`);
    if (!c.ok) failed += 1;
  }
  console.log(`\n${failed === 0 ? "数据就绪" : `${failed} 项需修复`}\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
