import pg from "pg";

const url =
  process.env.DATABASE_URL ||
  "postgresql://connectiq:ConnectIQ99%3F@sh-postgres-1xnkcmum.sql.tencentcdb.com:28409/postgres?sslmode=disable";

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes("sslmode=disable") ? false : { rejectUnauthorized: false },
});
await client.connect();
await client.query(`SET search_path TO public`);

const regs = await client.query(`
  SELECT
    to_regclass('public.experience_accounts') AS experience_accounts,
    to_regclass('public.organizer_applications') AS organizer_applications,
    to_regclass('public.billing_plans') AS billing_plans,
    to_regclass('public.invite_contact_blocks') AS invite_contact_blocks
`);
console.log("tables:", regs.rows[0]);

const cols = await client.query(`
  SELECT column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'organizer_applications'
    AND column_name IN ('source', 'experience_account_id')
  ORDER BY column_name
`);
console.log(
  "organizer_applications cols:",
  cols.rows.map((r) => r.column_name),
);

const en = await client.query(
  `SELECT 1 FROM pg_type t
   JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname='public' AND t.typname = 'ApplicationSource'`,
);
console.log("ApplicationSource enum:", Boolean(en.rowCount));

const campaignEnum = await client.query(`
  SELECT e.enumlabel
  FROM pg_enum e
  JOIN pg_type t ON e.enumtypid = t.oid
  WHERE t.typname = 'InviteCampaignStatus'
  ORDER BY e.enumsortorder
`);
console.log(
  "InviteCampaignStatus:",
  campaignEnum.rows.map((r) => r.enumlabel),
);

const demo = await client.query(`
  SELECT o.slug AS org_slug, e.slug AS event_slug
  FROM organizations o
  LEFT JOIN events e ON e.org_id = o.id
  WHERE o.slug = 'connectiq-innovation-hub'
     OR e.slug = 'smart-link-industry-expo-2026'
`);
console.log("demo rows:", demo.rows);

try {
  const plans = await client.query(
    `SELECT count(*)::int AS n FROM billing_plans`,
  );
  console.log("billing_plans count:", plans.rows[0].n);
} catch (e) {
  console.log("billing_plans count error:", e.message);
}

await client.end();
