-- 升级 organizations 表以匹配当前 Prisma schema（Supabase 执行）
-- 在 db push 失败、且需保留现有数据时使用

-- 1. 补充 account_type（已有行默认 CONFERENCE_ORGANIZER）
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS account_type TEXT;

UPDATE organizations
SET account_type = 'CONFERENCE_ORGANIZER'
WHERE account_type IS NULL;

ALTER TABLE organizations
  ALTER COLUMN account_type SET NOT NULL;

-- 2. 补充 admin_status
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS admin_status TEXT DEFAULT 'PENDING_REVIEW';

UPDATE organizations
SET admin_status = 'APPROVED', is_verified = true
WHERE admin_status IS NULL OR admin_status = 'PENDING_REVIEW';

-- 3. 补充 owner_id（可选，一对一）
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS owner_id TEXT UNIQUE;

-- 4. 其他常用字段（若缺失）
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS member_count INT DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS event_count INT DEFAULT 0;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS follower_count INT DEFAULT 0;

-- 6. 领英式主页扩展字段
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS industry TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS company_size TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS headquarters TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS founded_year INT;

-- 5. users 表 user_type / org_id（若尚未迁移）
ALTER TABLE users ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'END_USER';
ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id TEXT;

-- 验证
SELECT slug, account_type, admin_status, owner_id FROM organizations LIMIT 10;
