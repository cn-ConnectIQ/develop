-- Supabase Realtime：管理者面板 live-stats 相关表
-- 在 Supabase Dashboard → SQL Editor 执行，或通过 supabase db push 部署
--
-- 监听：签到流、连接、展位线索、互动回答
-- 频道约定见 apps/web/src/lib/realtime/channels.ts

-- ── 1. 加入 realtime publication ──
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'check_ins',
    'participants',
    'business_connections',
    'leads',
    'poll_responses'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
      RAISE NOTICE 'Added % to supabase_realtime', tbl;
    END IF;
  END LOOP;
END $$;

-- ── 2. UPDATE 过滤需要 REPLICA IDENTITY ──
ALTER TABLE public.participants REPLICA IDENTITY FULL;
ALTER TABLE public.leads REPLICA IDENTITY FULL;

-- ── 3. RLS：允许 anon 客户端通过 Realtime 接收 postgres_changes ──
-- Prisma 直连 Postgres 不受 RLS 影响；仅 Supabase Data/Realtime API 使用

ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT *
    FROM (VALUES
      ('check_ins', 'live_stats_read_check_ins'),
      ('participants', 'live_stats_read_participants'),
      ('business_connections', 'live_stats_read_business_connections'),
      ('leads', 'live_stats_read_leads'),
      ('poll_responses', 'live_stats_read_poll_responses')
    ) AS t(tablename, policyname)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = pol.tablename
        AND policyname = pol.policyname
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon, authenticated USING (true)',
        pol.policyname,
        pol.tablename
      );
    END IF;
  END LOOP;
END $$;
