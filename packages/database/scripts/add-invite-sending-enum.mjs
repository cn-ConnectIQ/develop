import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("supabase") ? { rejectUnauthorized: false } : false,
});

await client.connect();

const before = await client.query(`
  SELECT e.enumlabel
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'InviteRecordStatus'
  ORDER BY e.enumsortorder
`);
console.log("before", before.rows.map((r) => r.enumlabel));

const hasSending = before.rows.some((r) => r.enumlabel === "SENDING");
if (!hasSending) {
  try {
    await client.query(
      `ALTER TYPE "InviteRecordStatus" ADD VALUE IF NOT EXISTS 'SENDING' AFTER 'PENDING'`,
    );
  } catch {
    await client.query(
      `ALTER TYPE "InviteRecordStatus" ADD VALUE 'SENDING' AFTER 'PENDING'`,
    );
  }
}

const after = await client.query(`
  SELECT e.enumlabel
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'InviteRecordStatus'
  ORDER BY e.enumsortorder
`);
console.log("after", after.rows.map((r) => r.enumlabel));

await client.query(
  `CREATE INDEX IF NOT EXISTS invite_records_vendor_message_id_idx ON invite_records (vendor_message_id)`,
);
await client.query(
  `CREATE INDEX IF NOT EXISTS invite_records_status_updated_at_idx ON invite_records (status, updated_at)`,
);
console.log("indexes ok");
await client.end();
