import { prisma } from "../../src/client.js";

async function main() {
  const users = await prisma.$queryRaw<
    Array<{ column_name: string }>
  >`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name IN ('org_id', 'active_org_id')`;

  const apps = await prisma.$queryRaw<
    Array<{ indexname: string; indexdef: string }>
  >`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'organizer_applications' AND indexdef LIKE '%user_id%'`;

  const booths = await prisma.$queryRaw<
    Array<{ column_name: string }>
  >`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'booths' AND column_name IN ('exhibitor_id', 'company_org_id', 'operator_user_id')`;

  console.log("1. users columns:", users.map((r) => r.column_name));
  console.log("2. organizer_applications user_id indexes:");
  for (const row of apps) {
    console.log("  ", row.indexname, "->", row.indexdef);
  }
  console.log("3. booths columns:", booths.map((r) => r.column_name));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
