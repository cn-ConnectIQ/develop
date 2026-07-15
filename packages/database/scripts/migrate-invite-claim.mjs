/**
 * 生产库：邀请认领 phone_hash / first_used_at
 */
import pg from "pg";

const url =
  process.env.DATABASE_URL ||
  "postgresql://connectiq:ConnectIQ99%3F@sh-postgres-1xnkcmum.sql.tencentcdb.com:28409/postgres?sslmode=disable";

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});

await client.connect();
await client.query("SET search_path TO public");
console.log("connected", (await client.query("select current_database()")).rows[0]);

const stmts = [
  "ALTER TABLE public.invite_records ADD COLUMN IF NOT EXISTS phone_hash TEXT",
  "ALTER TABLE public.invite_records ADD COLUMN IF NOT EXISTS first_used_at TIMESTAMPTZ",
];

for (const sql of stmts) {
  await client.query(sql);
  console.log("ok", sql);
}

const cols = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'invite_records'
    AND column_name IN ('phone_hash', 'first_used_at', 'activation_token')
  ORDER BY column_name
`);
console.log("columns", cols.rows);
console.log("migrate-invite-claim ok");
await client.end();
