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

async function addEnumValue(typeName, value, after) {
  const existing = await client.query(
    `SELECT 1 FROM pg_enum e
     JOIN pg_type t ON e.enumtypid = t.oid
     WHERE t.typname = $1 AND e.enumlabel = $2`,
    [typeName, value],
  );
  if (existing.rowCount) {
    console.log(`enum ${typeName}.${value} exists`);
    return;
  }
  const sql = after
    ? `ALTER TYPE "${typeName}" ADD VALUE '${value}' AFTER '${after}'`
    : `ALTER TYPE "${typeName}" ADD VALUE '${value}'`;
  await client.query(sql);
  console.log(`added ${typeName}.${value}`);
}

await addEnumValue("InviteCampaignStatus", "CREATING", "DRAFT");
await addEnumValue("InviteCampaignStatus", "PAUSED", "SENDING");

await client.query(`
  CREATE TABLE IF NOT EXISTS invite_contact_blocks (
    id TEXT PRIMARY KEY,
    org_id TEXT,
    event_id TEXT,
    channel "InviteChannel",
    destination TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT 'BLACKLIST',
    note TEXT,
    created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);
await client.query(
  `CREATE INDEX IF NOT EXISTS invite_contact_blocks_destination_channel_idx ON invite_contact_blocks (destination, channel)`,
);
await client.query(
  `CREATE INDEX IF NOT EXISTS invite_contact_blocks_org_id_destination_idx ON invite_contact_blocks (org_id, destination)`,
);
await client.query(
  `CREATE INDEX IF NOT EXISTS invite_contact_blocks_event_id_destination_idx ON invite_contact_blocks (event_id, destination)`,
);

console.log("invite phase2 migration ok");
await client.end();
