ALTER TABLE invite_records ADD COLUMN IF NOT EXISTS phone_hash TEXT;
ALTER TABLE invite_records ADD COLUMN IF NOT EXISTS first_used_at TIMESTAMPTZ;
-- activation_token 新记录为 8 位 base62；历史 cuid 仍可读
