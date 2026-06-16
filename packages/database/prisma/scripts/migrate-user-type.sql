-- ConnectIQ：现有数据 user_type 补充（Supabase SQL Editor 执行）
-- 表名/列名与 Prisma schema 一致（users / user_type）

-- 1. 历史主办方测试账号 → ACCOUNT_ADMIN（排除平台管理员手机号）
UPDATE users
SET user_type = 'ACCOUNT_ADMIN'
WHERE user_type IN ('END_USER')
  AND phone IS NOT NULL
  AND phone <> '13800000001';

-- 若仍有 NULL（旧库未设默认值时）
UPDATE users
SET user_type = 'ACCOUNT_ADMIN'
WHERE user_type IS NULL
  AND phone IS NOT NULL
  AND phone <> '13800000001';

-- 2. 平台管理员手机号
UPDATE users
SET user_type = 'PLATFORM_ADMIN'
WHERE phone = '13800000001';

-- 3. 确认迁移结果
SELECT id, name, phone, user_type, org_id
FROM users
ORDER BY created_at
LIMIT 20;
