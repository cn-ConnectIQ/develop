-- 迁移：booths.exhibitor_id → company_org_id + operator_user_id
-- 在 prisma db push 之前执行

ALTER TABLE booths ADD COLUMN IF NOT EXISTS company_org_id TEXT;
ALTER TABLE booths ADD COLUMN IF NOT EXISTS operator_user_id TEXT;

UPDATE booths b
SET
  company_org_id = u.org_id,
  operator_user_id = b.exhibitor_id
FROM users u
WHERE u.id = b.exhibitor_id
  AND b.company_org_id IS NULL;

-- 若用户 org_id 为空，尝试从 org_staff / organizations.owner_id 回填参展商组织
UPDATE booths b
SET company_org_id = o.id
FROM organizations o
WHERE b.company_org_id IS NULL
  AND o.owner_id = b.exhibitor_id;
