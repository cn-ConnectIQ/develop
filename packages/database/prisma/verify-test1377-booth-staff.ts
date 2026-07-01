/**
 * 校验 TEST1377 每个展位是否至少有一名工作人员
 * 工作人员判定：operatorUserId / 组织 owner / 已接受 OrgStaff
 */
import { InviteStatus, OrgStaffRole } from "@prisma/client";
import { prisma } from "../src/client";
import { MOBILE_TEST_PRODUCTION_EVENT_ID } from "./seed-mobile-test-dimensions";

const STAFF_ROLES: OrgStaffRole[] = [
  OrgStaffRole.OWNER,
  OrgStaffRole.ADMIN,
  OrgStaffRole.MEMBER,
];

type BoothRow = Awaited<ReturnType<typeof loadBooths>>[number];

async function loadBooths() {
  return prisma.exhibitorBooth.findMany({
    where: { eventId: MOBILE_TEST_PRODUCTION_EVENT_ID },
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      operatorUserId: true,
      operator: { select: { id: true, name: true, phone: true } },
      companyOrg: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          owner: { select: { id: true, name: true, phone: true } },
          staff: {
            where: { status: InviteStatus.ACCEPTED },
            select: {
              role: true,
              user: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });
}

export function boothHasStaff(b: BoothRow) {
  if (b.operatorUserId && b.operator) {
    return { ok: true as const, via: "operator" as const, user: b.operator };
  }
  if (b.companyOrg.ownerId && b.companyOrg.owner) {
    return { ok: true as const, via: "owner" as const, user: b.companyOrg.owner };
  }
  const staff = b.companyOrg.staff.filter((s) => STAFF_ROLES.includes(s.role));
  if (staff.length > 0) {
    return {
      ok: true as const,
      via: "orgStaff" as const,
      user: staff[0]!.user,
      count: staff.length,
    };
  }
  return { ok: false as const };
}

export async function verifyTest1377BoothStaff() {
  const booths = await loadBooths();
  const covered: { code: string; via: string; name: string }[] = [];
  const missing: {
    id: string;
    code: string;
    org: string;
    status: string;
  }[] = [];

  for (const b of booths) {
    const s = boothHasStaff(b);
    if (s.ok) {
      covered.push({
        code: b.code,
        via: s.via,
        name: s.user.name ?? s.user.phone ?? s.user.id,
      });
    } else {
      missing.push({
        id: b.id,
        code: b.code,
        org: b.companyOrg.name,
        status: b.status,
      });
    }
  }

  return { booths, covered, missing };
}

async function main() {
  const { booths, covered, missing } = await verifyTest1377BoothStaff();

  console.log(`\n📋 TEST1377 展位工作人员校验（共 ${booths.length} 个展位）\n`);
  for (const row of covered) {
    console.log(`  ✓ ${row.code} — ${row.name} (${row.via})`);
  }
  if (missing.length > 0) {
    console.log(`\n  ✗ 缺少工作人员 (${missing.length})：`);
    for (const m of missing) {
      console.log(`    · ${m.code} ${m.org} [${m.status}] id=${m.id}`);
    }
    process.exitCode = 1;
  } else {
    console.log(`\n✅ 全部 ${booths.length} 个展位均至少有一名工作人员`);
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  process.argv[1].replace(/\\/g, "/").includes("verify-test1377-booth-staff");

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
