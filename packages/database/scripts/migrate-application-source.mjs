import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const urls = [];
const webEnv = loadEnvFile(
  path.resolve(__dirname, "../../../apps/web/.env.local"),
);
for (const [name, key] of [
  ["apps/web/.env.local", "DATABASE_URL"],
  ["apps/web/.env.local DIRECT", "DATABASE_URL_DIRECT"],
  ["env DATABASE_URL", "env"],
]) {
  const url =
    key === "env" ? process.env.DATABASE_URL : webEnv[key];
  if (!url || !url.includes("://")) continue;
  if (urls.some((u) => u.url === url)) continue;
  urls.push({ name, url });
}

if (!urls.length) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

async function migrateOne(label, url) {
  console.log(`\n==> ${label}`);
  const safeUrl = url
    .replace(/[?&]sslmode=[^&]*/g, "")
    .replace(/[?&]uselibpqcompat=[^&]*/g, "");
  const client = new pg.Client({
    connectionString: safeUrl,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const enumExists = await client.query(
    `SELECT 1 FROM pg_type WHERE typname = 'ApplicationSource'`,
  );
  if (!enumExists.rowCount) {
    await client.query(
      `CREATE TYPE "ApplicationSource" AS ENUM ('SELF_REGISTER', 'EXPERIENCE_DEMO')`,
    );
    console.log("created ApplicationSource enum");
  } else {
    console.log("ApplicationSource enum exists");
  }

  await client.query(`
    ALTER TABLE organizer_applications
    ADD COLUMN IF NOT EXISTS source "ApplicationSource" NOT NULL DEFAULT 'SELF_REGISTER'
  `);
  await client.query(`
    ALTER TABLE organizer_applications
    ADD COLUMN IF NOT EXISTS experience_account_id TEXT
  `);

  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS organizer_applications_experience_account_id_key
    ON organizer_applications (experience_account_id)
  `);

  const expTable = await client.query(
    `SELECT to_regclass('public.experience_accounts') AS rel`,
  );
  if (expTable.rows[0]?.rel) {
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE organizer_applications
          ADD CONSTRAINT organizer_applications_experience_account_id_fkey
          FOREIGN KEY (experience_account_id)
          REFERENCES experience_accounts(id)
          ON DELETE SET NULL
          ON UPDATE CASCADE;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
        WHEN undefined_table THEN NULL;
      END $$
    `);
    console.log("FK experience_account_id linked");
  } else {
    console.warn("skip FK: experience_accounts missing");
  }

  await client.query(`
    CREATE INDEX IF NOT EXISTS organizer_applications_source_status_idx
    ON organizer_applications (source, status)
  `);

  console.log("ok");
  await client.end();
}

for (const item of urls) {
  try {
    await migrateOne(item.name, item.url);
  } catch (err) {
    console.error(`FAILED ${item.name}:`, err.message);
  }
}
