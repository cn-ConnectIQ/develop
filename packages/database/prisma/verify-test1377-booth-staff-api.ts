/**
 * 校验 TEST1377 展位 API 是否返回 staff / contact 字段
 * 用法：pnpm --filter @connectiq/database db:verify-test1377-booth-staff-api
 */
import { prisma } from "../src/client";
import { MOBILE_TEST_PRODUCTION_EVENT_ID } from "./seed-mobile-test-dimensions";

const BASE_URL =
  process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

async function fetchBoothStaff(boothId: string) {
  const proxy = process.env.SMOKE_HTTP_PROXY ?? process.env.HTTP_PROXY;
  const args = [
    "-sS",
    "-m",
    "60",
    "--ssl-no-revoke",
    "-w",
    "__HTTP_CODE__%{http_code}",
  ];
  if (proxy) args.push("-x", proxy);
  args.push(`${BASE_URL}/api/booths/${boothId}`);

  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);
  const { stdout } = await execFileAsync("curl.exe", args, { maxBuffer: 5 * 1024 * 1024 });

  const marker = "__HTTP_CODE__";
  const idx = stdout.lastIndexOf(marker);
  const bodyText = idx >= 0 ? stdout.slice(0, idx) : stdout;
  const status = idx >= 0 ? Number(stdout.slice(idx + marker.length).trim()) : 0;
  const body = JSON.parse(bodyText) as { data?: Record<string, unknown> };
  return { status, data: body.data ?? body };
}

async function main() {
  const booths = await prisma.exhibitorBooth.findMany({
    where: { eventId: MOBILE_TEST_PRODUCTION_EVENT_ID },
    select: { id: true, code: true },
    orderBy: { code: "asc" },
  });

  console.log(`\n📡 TEST1377 展位 API staff 校验 @ ${BASE_URL}\n`);

  let missing = 0;
  for (const booth of booths) {
    try {
      const { status, data } = await fetchBoothStaff(booth.id);
      const staff = data.staff;
      const count = Array.isArray(staff) ? staff.length : 0;
      const ok = status === 200 && count > 0;
      if (!ok) missing += 1;
      console.log(
        `${ok ? "✓" : "✗"} ${booth.code} HTTP ${status} staff=${count} contact=${data.contact_name ?? "—"}`,
      );
    } catch (err) {
      missing += 1;
      console.log(`✗ ${booth.code} ${(err as Error).message}`);
    }
  }

  if (missing > 0) {
    console.log(`\n✗ ${missing}/${booths.length} 个展位 API 未返回 staff`);
    process.exitCode = 1;
  } else {
    console.log(`\n✅ 全部 ${booths.length} 个展位 API 均有工作人员`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
