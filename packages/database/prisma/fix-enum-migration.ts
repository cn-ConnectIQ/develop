/** 清理 db push 失败后残留的枚举类型 */
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
    console.log("→ 移除 event_reviews.status 默认值 …");
    await client.query(`
      ALTER TABLE event_reviews ALTER COLUMN status DROP DEFAULT;
    `).catch(() => {});

    console.log("→ 确保 event_reviews.status 为 TEXT …");
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'event_reviews' AND column_name = 'status'
            AND data_type <> 'text'
        ) THEN
          ALTER TABLE event_reviews
            ALTER COLUMN status TYPE text USING status::text;
        END IF;
      END $$;
    `);

    console.log("→ 确保 events.review_status 为 TEXT …");
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'events' AND column_name = 'review_status'
            AND data_type <> 'text'
        ) THEN
          ALTER TABLE events ALTER COLUMN review_status DROP DEFAULT;
          ALTER TABLE events
            ALTER COLUMN review_status TYPE text
            USING review_status::text;
        END IF;
      END $$;
    `);

    console.log("→ 清理残留枚举类型 …");
    for (const name of ["ReviewStatus_new", "ReviewStatus_old"]) {
      await client.query(`DROP TYPE IF EXISTS "${name}" CASCADE`).catch(() => {});
    }

    console.log("→ 创建 EventReviewStatus 枚举（若不存在）…");
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'EventReviewStatus') THEN
          CREATE TYPE "EventReviewStatus" AS ENUM (
            'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED'
          );
        END IF;
      END $$;
    `);

    console.log("→ 重建 ReviewStatus 枚举 …");
    await client.query(`DROP TYPE IF EXISTS "ReviewStatus" CASCADE`).catch(() => {});
    await client.query(`
      CREATE TYPE "ReviewStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LIVE', 'ENDED');
    `);

    console.log("→ 转换 events.review_status → ReviewStatus …");
    await client.query(`
      ALTER TABLE events
        ALTER COLUMN review_status TYPE "ReviewStatus"
        USING (
          CASE review_status
            WHEN 'DRAFT' THEN 'DRAFT'::"ReviewStatus"
            WHEN 'PUBLISHED' THEN 'PUBLISHED'::"ReviewStatus"
            WHEN 'LIVE' THEN 'LIVE'::"ReviewStatus"
            WHEN 'ENDED' THEN 'ENDED'::"ReviewStatus"
            ELSE 'DRAFT'::"ReviewStatus"
          END
        );
      ALTER TABLE events ALTER COLUMN review_status SET DEFAULT 'DRAFT';
    `);

    console.log("→ 转换 event_reviews.status → EventReviewStatus …");
    await client.query(`
      ALTER TABLE event_reviews
        ALTER COLUMN status TYPE "EventReviewStatus"
        USING (
          CASE status
            WHEN 'PENDING_REVIEW' THEN 'PENDING_REVIEW'::"EventReviewStatus"
            WHEN 'APPROVED' THEN 'APPROVED'::"EventReviewStatus"
            WHEN 'REJECTED' THEN 'REJECTED'::"EventReviewStatus"
            WHEN 'REVISION_REQUIRED' THEN 'REVISION_REQUIRED'::"EventReviewStatus"
            ELSE 'PENDING_REVIEW'::"EventReviewStatus"
          END
        );
      ALTER TABLE event_reviews
        ALTER COLUMN status SET DEFAULT 'PENDING_REVIEW'::"EventReviewStatus";
    `);

    console.log("→ 创建 ActivityType / DataSource …");
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ActivityType') THEN
          CREATE TYPE "ActivityType" AS ENUM ('CONFERENCE', 'EXPO', 'EXHIBITION');
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DataSource') THEN
          CREATE TYPE "DataSource" AS ENUM ('NATIVE', 'BAGEVENT', 'MARKETUP');
        END IF;
      END $$;
    `);

    console.log("→ 转换 events.activity_type / data_source …");
    await client.query(`
      ALTER TABLE events
        ALTER COLUMN activity_type TYPE "ActivityType"
        USING (
          CASE COALESCE(activity_type, 'CONFERENCE')
            WHEN 'EXPO' THEN 'EXPO'::"ActivityType"
            WHEN 'EXHIBITION' THEN 'EXHIBITION'::"ActivityType"
            ELSE 'CONFERENCE'::"ActivityType"
          END
        );
      ALTER TABLE events ALTER COLUMN activity_type SET DEFAULT 'CONFERENCE'::"ActivityType";
      ALTER TABLE events
        ALTER COLUMN data_source TYPE "DataSource"
        USING COALESCE(data_source, 'NATIVE')::"DataSource";
      ALTER TABLE events ALTER COLUMN data_source SET DEFAULT 'NATIVE'::"DataSource";
    `).catch((e) => console.warn("activity/data_source:", e.message));

    console.log("✓ 枚举清理完成");
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
