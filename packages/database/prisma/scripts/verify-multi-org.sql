-- 验证 schema 变更
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'users'
  AND column_name IN ('org_id', 'active_org_id');

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'organizer_applications'
  AND indexdef LIKE '%user_id%';

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'booths'
  AND column_name IN ('exhibitor_id', 'company_org_id', 'operator_user_id');
