/** db push 后回填 activity_type（若列被重建） */
import "dotenv/config";
import pg from "pg";

const connectionString =
  process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "";

async function run() {
  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(`
      UPDATE events e
      SET activity_type = CASE
        WHEN e.type = 'EXPO' THEN 'EXPO'::"ActivityType"
        WHEN o.account_type = 'EXHIBITOR' THEN 'EXHIBITION'::"ActivityType"
        WHEN o.account_type = 'EXPO_ORGANIZER' THEN 'EXPO'::"ActivityType"
        ELSE 'CONFERENCE'::"ActivityType"
      END
      FROM organizations o
      WHERE e.org_id = o.id;
    `);
    await client.query(`
      UPDATE events SET activity_type = CASE
        WHEN type = 'EXPO' THEN 'EXPO'::"ActivityType"
        ELSE 'CONFERENCE'::"ActivityType"
      END
      WHERE activity_type IS NULL;
    `);
    const check = await client.query(`
      SELECT activity_type, COUNT(*)::int AS n FROM events GROUP BY 1 ORDER BY 1
    `);
    const userCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('org_id','active_org_id')
    `);
    const orgStats = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'organizations' AND column_name LIKE 'total_%'
      ORDER BY 1
    `);
    console.log("activity_type 分布:", check.rows);
    console.log("users 列:", userCols.rows.map((r) => r.column_name));
    console.log("organizations 汇总列:", orgStats.rows.map((r) => r.column_name));
    console.log("✓ 回填与验收完成");
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
