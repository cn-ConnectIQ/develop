-- Supabase / PostgreSQL：启用 pgvector 并为意向 embedding 建 HNSW 索引
-- 在 Supabase SQL Editor 或 psql 中执行一次即可

CREATE EXTENSION IF NOT EXISTS vector;

-- UserEventIntent.embedding 列需已通过 prisma db push 创建
CREATE INDEX IF NOT EXISTS user_event_intents_embedding_hnsw_idx
  ON user_event_intents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
