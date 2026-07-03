/**
 * UserRedemptionCode → UserEventCode（一码通）迁移脚本
 *
 * 运行顺序：
 *   1. pnpm --filter @connectiq/database db:migrate-user-event-code
 *   2. pnpm --filter @connectiq/database db:push
 *   3. pnpm --filter @connectiq/database db:generate
 *
 * 迁移内容：
 *   - user_redemption_codes → user_event_codes（保留数据）
 *   - lottery_winners.redemption_code_id → event_code_id
 */
import "dotenv/config";
import pg from "pg";

// Supabase pooler 等环境需跳过自签证书校验（与 migrate-account-model 一致）
process.env.NODE_TLS_REJECT_UNAUTHORIZED ??= "0";

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
    console.log("→ 检查 user_redemption_codes → user_event_codes …");
    const tableResult = await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'user_redemption_codes'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'user_event_codes'
        ) THEN
          ALTER TABLE user_redemption_codes RENAME TO user_event_codes;
          RAISE NOTICE 'Renamed user_redemption_codes → user_event_codes';
        ELSIF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'user_event_codes'
        ) THEN
          RAISE NOTICE 'user_event_codes already exists, skip table rename';
        ELSE
          RAISE NOTICE 'user_redemption_codes not found, skip table rename';
        END IF;
      END $$;
    `);
    void tableResult;

    console.log("→ 检查 lottery_winners.redemption_code_id → event_code_id …");
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'lottery_winners'
            AND column_name = 'redemption_code_id'
        ) AND NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'lottery_winners'
            AND column_name = 'event_code_id'
        ) THEN
          ALTER TABLE lottery_winners
            RENAME COLUMN redemption_code_id TO event_code_id;
          RAISE NOTICE 'Renamed redemption_code_id → event_code_id';
        ELSIF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'lottery_winners'
            AND column_name = 'event_code_id'
        ) THEN
          RAISE NOTICE 'event_code_id already exists, skip column rename';
        ELSE
          RAISE NOTICE 'redemption_code_id not found, skip column rename';
        END IF;
      END $$;
    `);

    console.log("✓ UserEventCode 迁移完成，请继续执行 db:push 与 db:generate");
  } finally {
    await client.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
