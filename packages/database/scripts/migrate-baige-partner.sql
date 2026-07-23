/**
 * 百格伙伴绑定表 DDL（幂等）
 */
DO $$ BEGIN
  CREATE TYPE "PartnerConnectionStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS partner_connections (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  external_org_id TEXT NOT NULL,
  status "PartnerConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  metadata JSONB,
  linked_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_connections_provider_org_id_key
  ON partner_connections(provider, org_id);
CREATE UNIQUE INDEX IF NOT EXISTS partner_connections_provider_external_org_id_key
  ON partner_connections(provider, external_org_id);
CREATE INDEX IF NOT EXISTS partner_connections_provider_status_idx
  ON partner_connections(provider, status);
