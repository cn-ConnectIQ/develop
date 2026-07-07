/**
 * SystemRole.STAFF → ORGANIZER_STAFF 枚举重命名迁移
 *
 * 用法: pnpm --filter @connectiq/database db:migrate-system-role-staff
 *
 * 说明: PostgreSQL 10+ 支持 ALTER TYPE ... RENAME VALUE，会同步更新
 * participants.system_role 列中所有引用该枚举值的行，无需单独 UPDATE。
 */
import "dotenv/config";
import pg from "pg";

const connectionString =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

async function run() {
  if (!connectionString) {
    console.error("缺少 DATABASE_URL / DIRECT_URL");
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    const enumCheck = await client.query<{ exists: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'SystemRole' AND e.enumlabel = 'STAFF'
      ) AS exists;
    `);

    const hasStaff = enumCheck.rows[0]?.exists ?? false;

    if (!hasStaff) {
      const hasNew = await client.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'SystemRole' AND e.enumlabel = 'ORGANIZER_STAFF'
        ) AS exists;
      `);
      if (hasNew.rows[0]?.exists) {
        console.log("✓ SystemRole.ORGANIZER_STAFF 已存在，跳过迁移");
        return;
      }
      console.warn("⚠ SystemRole 枚举中既无 STAFF 也无 ORGANIZER_STAFF，请检查 schema");
      return;
    }

    const countResult = await client.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM participants WHERE system_role = 'STAFF';
    `);
    const staffCount = Number(countResult.rows[0]?.count ?? 0);
    console.log(`→ 发现 ${staffCount} 条 system_role=STAFF 的参会者记录`);

    console.log("→ ALTER TYPE SystemRole RENAME VALUE 'STAFF' TO 'ORGANIZER_STAFF' …");
    await client.query(`
      ALTER TYPE "SystemRole" RENAME VALUE 'STAFF' TO 'ORGANIZER_STAFF';
    `);

    const verify = await client.query<{ count: string }>(`
      SELECT COUNT(*)::text AS count FROM participants WHERE system_role = 'ORGANIZER_STAFF';
    `);
    console.log(
      `✓ 迁移完成，当前 ORGANIZER_STAFF 记录数: ${verify.rows[0]?.count ?? 0}`,
    );
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
