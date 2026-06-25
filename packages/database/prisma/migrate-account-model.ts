/**
 * 账号与活动模型迁移脚本
 *
 * 运行顺序（首次部署新 schema 前）：
 *   1. pnpm --filter @connectiq/database db:migrate-account-model
 *   2. pnpm --filter @connectiq/database db:push
 *   3. pnpm --filter @connectiq/database db:generate
 *
 * 迁移内容：
 *   - users.active_org_id → org_id
 *   - events 补全 org_id、推断 activity_type
 *   - events.review_status 旧平台审核值 → 新发布状态
 *   - organizations 汇总字段回填
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
    console.log("→ 迁移 users.active_org_id → org_id …");
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'active_org_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'org_id'
        ) THEN
          ALTER TABLE users RENAME COLUMN active_org_id TO org_id;
        ELSIF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'active_org_id'
        ) AND EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'org_id'
        ) THEN
          UPDATE users SET org_id = active_org_id WHERE org_id IS NULL AND active_org_id IS NOT NULL;
          ALTER TABLE users DROP COLUMN IF EXISTS active_org_id;
        END IF;
      END $$;
    `);

    console.log("→ 补全 events.org_id …");
    await client.query(`
      UPDATE events e
      SET org_id = o.id
      FROM organizations o
      WHERE e.org_id IS NULL
        AND e.organizer_id = o.owner_id;
    `);
    await client.query(`
      UPDATE events
      SET org_id = (SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1)
      WHERE org_id IS NULL
        AND EXISTS (SELECT 1 FROM organizations LIMIT 1);
    `);

    console.log("→ 迁移 events.review_status（先转 TEXT 再映射新值）…");
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'events'
            AND column_name = 'review_status'
            AND udt_name = 'ReviewStatus'
        ) THEN
          ALTER TABLE events
            ALTER COLUMN review_status DROP DEFAULT;
          ALTER TABLE events
            ALTER COLUMN review_status TYPE text
            USING review_status::text;
        END IF;
      END $$;
    `);
    await client.query(`
      UPDATE events SET review_status = 'PUBLISHED'
      WHERE review_status = 'APPROVED';
      UPDATE events SET review_status = 'DRAFT'
      WHERE review_status IN ('PENDING_REVIEW', 'REVISION_REQUIRED', 'REJECTED');
    `);

    console.log("→ 迁移 event_reviews.status 为 TEXT（保留平台审核值）…");
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'event_reviews'
            AND column_name = 'status'
            AND data_type <> 'text'
        ) THEN
          ALTER TABLE event_reviews
            ALTER COLUMN status TYPE text
            USING status::text;
        END IF;
      END $$;
    `);

    console.log("→ 添加 events.activity_type（若不存在）并回填 …");
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'events' AND column_name = 'activity_type'
        ) THEN
          ALTER TABLE events ADD COLUMN activity_type TEXT;
        END IF;
      END $$;
    `);

    await client.query(`
      UPDATE events e
      SET activity_type = CASE
        WHEN e.type = 'EXPO' THEN 'EXPO'
        WHEN o.account_type = 'EXHIBITOR' THEN 'EXHIBITION'
        WHEN o.account_type = 'EXPO_ORGANIZER' THEN 'EXPO'
        ELSE 'CONFERENCE'
      END
      FROM organizations o
      WHERE e.org_id = o.id
        AND (e.activity_type IS NULL OR e.activity_type = '');
    `);

    await client.query(`
      UPDATE events SET activity_type = CASE
        WHEN type = 'EXPO' THEN 'EXPO'
        ELSE 'CONFERENCE'
      END
      WHERE activity_type IS NULL OR activity_type = '';
    `);

    console.log("→ 添加 events.data_source / external_ref_id …");
    await client.query(`
      ALTER TABLE events
        ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'NATIVE',
        ADD COLUMN IF NOT EXISTS external_ref_id TEXT;
    `);

    console.log("→ 添加 organizations 汇总字段 …");
    await client.query(`
      ALTER TABLE organizations
        ADD COLUMN IF NOT EXISTS total_events INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_participants INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_leads INT NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS total_connections INT NOT NULL DEFAULT 0;
    `);

    await client.query(`
      UPDATE organizations o SET
        total_events = COALESCE((
          SELECT COUNT(*)::int FROM events e WHERE e.org_id = o.id
        ), 0),
        total_participants = COALESCE((
          SELECT COUNT(*)::int FROM participants p
          JOIN events e ON e.id = p.event_id WHERE e.org_id = o.id
        ), 0),
        total_leads = COALESCE((
          SELECT COUNT(*)::int FROM leads l
          JOIN booths b ON b.id = l.booth_id
          JOIN events e ON e.id = b.event_id WHERE e.org_id = o.id
        ), 0),
        total_connections = COALESCE((
          SELECT COUNT(*)::int FROM business_connections c
          WHERE c.event_id IN (SELECT id FROM events WHERE org_id = o.id)
        ), 0);
    `);

    console.log("✓ 账号模型数据迁移完成");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
