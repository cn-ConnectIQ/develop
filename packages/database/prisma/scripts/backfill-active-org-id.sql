-- 回填 users.active_org_id（从组织 owner 关系恢复）
UPDATE users u
SET active_org_id = o.id
FROM organizations o
WHERE o.owner_id = u.id
  AND u.active_org_id IS NULL;
