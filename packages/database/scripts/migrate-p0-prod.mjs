/**
 * 生产库 public schema 增量补齐
 * （用户 connectiq 的 search_path 会优先误伤同名 connectiq schema）
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
await client.query(`SET search_path TO public`);
console.log("connected", (await client.query("select current_database()")).rows[0]);

async function enumExists(typeName) {
  const r = await client.query(
    `SELECT 1
     FROM pg_type t
     JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typname = $1`,
    [typeName],
  );
  return Boolean(r.rowCount);
}

async function ensureEnum(typeName, values) {
  if (await enumExists(typeName)) {
    console.log(`enum public.${typeName} exists`);
    for (const value of values) {
      const has = await client.query(
        `SELECT 1 FROM pg_enum e
         JOIN pg_type t ON e.enumtypid = t.oid
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND t.typname = $1 AND e.enumlabel = $2`,
        [typeName, value],
      );
      if (!has.rowCount) {
        await client.query(
          `ALTER TYPE public."${typeName}" ADD VALUE IF NOT EXISTS '${value}'`,
        );
        console.log(`  + public.${typeName}.${value}`);
      }
    }
    return;
  }
  const list = values.map((v) => `'${v}'`).join(", ");
  await client.query(`CREATE TYPE public."${typeName}" AS ENUM (${list})`);
  console.log(`created enum public.${typeName}`);
}

async function tableExists(name) {
  const r = await client.query(`SELECT to_regclass($1) AS rel`, [
    `public.${name}`,
  ]);
  return Boolean(r.rows[0].rel);
}

async function columnExists(table, column) {
  const r = await client.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column],
  );
  return Boolean(r.rowCount);
}

await ensureEnum("ApplicationSource", ["SELF_REGISTER", "EXPERIENCE_DEMO"]);
await ensureEnum("ExperienceAccountStatus", [
  "ACTIVE",
  "EXPIRED",
  "CONVERTED",
  "REVOKED",
]);
await ensureEnum("ExperienceAccountRole", ["PRIMARY", "COLLEAGUE"]);
await ensureEnum("BillingPlanKind", [
  "EVENT_USAGE",
  "SMS_PACK",
  "EMAIL_PACK",
  "INTERACTION_TOPUP",
]);
await ensureEnum("BillingOrderStatus", [
  "PENDING",
  "PAID",
  "FAILED",
  "CANCELLED",
  "REFUNDED",
]);
await ensureEnum("BillingPaymentChannel", [
  "MANUAL",
  "WECHAT",
  "ALIPAY",
  "OTHER",
]);
await ensureEnum("BillingLedgerType", ["CREDIT", "DEBIT", "ADJUST", "REFUND"]);
await ensureEnum("BillingLedgerResource", ["SMS", "EMAIL", "INTERACTION_POINT"]);
await ensureEnum("InviteCampaignStatus", [
  "DRAFT",
  "CREATING",
  "SENDING",
  "PAUSED",
  "SENT",
  "FAILED",
  "SCHEDULED",
]);
await ensureEnum("InviteRecordStatus", [
  "PENDING",
  "SENDING",
  "SENT",
  "DELIVERED",
  "CLICKED",
  "ACTIVATED",
  "FAILED",
  "SKIPPED",
]);

if (!(await columnExists("organizer_applications", "source"))) {
  await client.query(`
    ALTER TABLE public.organizer_applications
    ADD COLUMN source public."ApplicationSource" NOT NULL DEFAULT 'SELF_REGISTER'
  `);
  console.log("added public.organizer_applications.source");
}
if (!(await columnExists("organizer_applications", "experience_account_id"))) {
  await client.query(`
    ALTER TABLE public.organizer_applications
    ADD COLUMN experience_account_id TEXT
  `);
  console.log("added public.organizer_applications.experience_account_id");
}
await client.query(`
  CREATE UNIQUE INDEX IF NOT EXISTS organizer_applications_experience_account_id_key
  ON public.organizer_applications (experience_account_id)
`);
await client.query(`
  CREATE INDEX IF NOT EXISTS organizer_applications_source_status_idx
  ON public.organizer_applications (source, status)
`);

if (!(await tableExists("experience_accounts"))) {
  await client.query(`
    CREATE TABLE public.experience_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      org_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      org_staff_id TEXT,
      participant_id TEXT,
      role public."ExperienceAccountRole" NOT NULL DEFAULT 'PRIMARY',
      invited_by_user_id TEXT,
      status public."ExperienceAccountStatus" NOT NULL DEFAULT 'ACTIVE',
      started_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TIMESTAMP(3) NOT NULL,
      contact_name TEXT,
      company_name TEXT,
      phone TEXT NOT NULL,
      converted_at TIMESTAMP(3),
      converted_by_user_id TEXT,
      converted_org_id TEXT,
      extended_count INTEGER NOT NULL DEFAULT 0,
      last_extended_at TIMESTAMP(3),
      last_extended_by_user_id TEXT,
      platform_notes TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT experience_accounts_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT experience_accounts_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT experience_accounts_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT experience_accounts_invited_by_user_id_fkey
        FOREIGN KEY (invited_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT experience_accounts_converted_by_user_id_fkey
        FOREIGN KEY (converted_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT experience_accounts_last_extended_by_user_id_fkey
        FOREIGN KEY (last_extended_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS experience_accounts_status_idx ON public.experience_accounts (status)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS experience_accounts_expires_at_idx ON public.experience_accounts (expires_at)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS experience_accounts_event_id_idx ON public.experience_accounts (event_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS experience_accounts_org_id_idx ON public.experience_accounts (org_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS experience_accounts_invited_by_user_id_idx ON public.experience_accounts (invited_by_user_id)`,
  );
  console.log("created public.experience_accounts");
}

await client.query(`
  DO $$ BEGIN
    ALTER TABLE public.organizer_applications
      ADD CONSTRAINT organizer_applications_experience_account_id_fkey
      FOREIGN KEY (experience_account_id)
      REFERENCES public.experience_accounts(id)
      ON DELETE SET NULL ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$
`);

if (!(await tableExists("invite_contact_blocks"))) {
  await client.query(`
    CREATE TABLE public.invite_contact_blocks (
      id TEXT PRIMARY KEY,
      org_id TEXT,
      event_id TEXT,
      channel public."InviteChannel",
      destination TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT 'BLACKLIST',
      note TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS invite_contact_blocks_destination_channel_idx ON public.invite_contact_blocks (destination, channel)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS invite_contact_blocks_org_id_destination_idx ON public.invite_contact_blocks (org_id, destination)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS invite_contact_blocks_event_id_destination_idx ON public.invite_contact_blocks (event_id, destination)`,
  );
  console.log("created public.invite_contact_blocks");
}

if (!(await tableExists("billing_plans"))) {
  await client.query(`
    CREATE TABLE public.billing_plans (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      kind public."BillingPlanKind" NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      price_cents INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'CNY',
      includes_sms INTEGER NOT NULL DEFAULT 0,
      includes_email INTEGER NOT NULL DEFAULT 0,
      includes_interaction_points INTEGER NOT NULL DEFAULT 0,
      max_attendees INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      metadata JSONB,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS billing_plans_kind_is_active_idx ON public.billing_plans (kind, is_active)`,
  );
  console.log("created public.billing_plans");
}

if (!(await tableExists("billing_orders"))) {
  await client.query(`
    CREATE TABLE public.billing_orders (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      plan_id TEXT,
      created_by_user_id TEXT,
      event_id TEXT,
      status public."BillingOrderStatus" NOT NULL DEFAULT 'PENDING',
      payment_channel public."BillingPaymentChannel" NOT NULL DEFAULT 'MANUAL',
      amount_cents INTEGER NOT NULL,
      currency TEXT NOT NULL DEFAULT 'CNY',
      title TEXT NOT NULL,
      external_payment_id TEXT,
      paid_at TIMESTAMP(3),
      metadata JSONB,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT billing_orders_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT billing_orders_plan_id_fkey
        FOREIGN KEY (plan_id) REFERENCES public.billing_plans(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT billing_orders_created_by_user_id_fkey
        FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT billing_orders_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS billing_orders_org_id_status_idx ON public.billing_orders (org_id, status)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS billing_orders_event_id_idx ON public.billing_orders (event_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS billing_orders_external_payment_id_idx ON public.billing_orders (external_payment_id)`,
  );
  console.log("created public.billing_orders");
}

if (!(await tableExists("org_wallets"))) {
  await client.query(`
    CREATE TABLE public.org_wallets (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL UNIQUE,
      sms_balance INTEGER NOT NULL DEFAULT 0,
      email_balance INTEGER NOT NULL DEFAULT 0,
      interaction_points_balance INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT org_wallets_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);
  console.log("created public.org_wallets");
}

if (!(await tableExists("billing_ledgers"))) {
  await client.query(`
    CREATE TABLE public.billing_ledgers (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      wallet_id TEXT,
      order_id TEXT,
      event_id TEXT,
      type public."BillingLedgerType" NOT NULL,
      resource public."BillingLedgerResource" NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      remark TEXT,
      created_by_user_id TEXT,
      created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT billing_ledgers_org_id_fkey
        FOREIGN KEY (org_id) REFERENCES public.organizations(id) ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT billing_ledgers_wallet_id_fkey
        FOREIGN KEY (wallet_id) REFERENCES public.org_wallets(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT billing_ledgers_order_id_fkey
        FOREIGN KEY (order_id) REFERENCES public.billing_orders(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT billing_ledgers_event_id_fkey
        FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT billing_ledgers_created_by_user_id_fkey
        FOREIGN KEY (created_by_user_id) REFERENCES public.users(id) ON DELETE SET NULL ON UPDATE CASCADE
    )
  `);
  await client.query(
    `CREATE INDEX IF NOT EXISTS billing_ledgers_org_id_resource_created_at_idx ON public.billing_ledgers (org_id, resource, created_at)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS billing_ledgers_order_id_idx ON public.billing_ledgers (order_id)`,
  );
  await client.query(
    `CREATE INDEX IF NOT EXISTS billing_ledgers_wallet_id_idx ON public.billing_ledgers (wallet_id)`,
  );
  console.log("created public.billing_ledgers");
}

console.log("migrate-p0-prod ok");
await client.end();
