import { createHash, randomBytes } from "crypto";
import {
  BAIGE_DEFAULT_SCOPES,
  getBaigeOAuthConfig,
  isBaigeOAuthConfigured,
} from "@/lib/integrations/baige-partner-constants";
import { upsertBaigeConnection } from "@/lib/integrations/baige-connection-service";
import { cacheDel, cacheGet, cacheSet } from "@/lib/redis";

const STATE_TTL_SEC = 600;

function stateKey(state: string) {
  return `baige-oauth-state:${state}`;
}

export class BaigeOAuthError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

export async function createBaigeOAuthStart(input: {
  orgId: string;
  userId: string;
}) {
  if (!isBaigeOAuthConfigured()) {
    throw new BaigeOAuthError(
      "未配置百格 OAuth（BAIGE_OAUTH_CLIENT_ID/SECRET）",
      "NOT_CONFIGURED",
    );
  }

  const cfg = getBaigeOAuthConfig();
  const state = randomBytes(24).toString("hex");
  await cacheSet(
    stateKey(state),
    JSON.stringify({ orgId: input.orgId, userId: input.userId }),
    STATE_TTL_SEC,
  );

  const url = new URL(cfg.authorizeUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", cfg.redirectUri);
  url.searchParams.set("scope", BAIGE_DEFAULT_SCOPES.join(" "));
  url.searchParams.set("state", state);

  return { authorizeUrl: url.toString(), state };
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  org_id?: string;
  external_org_id?: string;
};

async function exchangeBaigeCode(code: string): Promise<TokenResponse> {
  const cfg = getBaigeOAuthConfig();
  const res = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as TokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    throw new BaigeOAuthError(
      json.error_description || json.error || "换取 access_token 失败",
      "TOKEN_EXCHANGE_FAILED",
    );
  }

  return json;
}

async function fetchBaigeOrgProfile(accessToken: string) {
  const cfg = getBaigeOAuthConfig();
  const res = await fetch(`${cfg.apiBase}/me/org`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json().catch(() => null)) as {
    data?: { id?: string; org_id?: string; name?: string };
    id?: string;
    org_id?: string;
    name?: string;
  } | null;
  if (!json) return null;
  const data = json.data ?? json;
  return {
    id: String(data.id ?? data.org_id ?? "").trim(),
    name: typeof data.name === "string" ? data.name : null,
  };
}

export async function completeBaigeOAuthCallback(input: {
  code: string;
  state: string;
}) {
  const raw = await cacheGet(stateKey(input.state));
  if (!raw) {
    throw new BaigeOAuthError("授权 state 无效或已过期", "INVALID_STATE");
  }
  await cacheDel(stateKey(input.state));

  const parsed = JSON.parse(raw) as { orgId: string; userId: string };
  const token = await exchangeBaigeCode(input.code);
  if (!token.access_token) {
    throw new BaigeOAuthError("未返回 access_token", "TOKEN_EXCHANGE_FAILED");
  }

  let externalOrgId =
    token.external_org_id?.trim() || token.org_id?.trim() || "";
  let orgName: string | null = null;

  const profile = await fetchBaigeOrgProfile(token.access_token);
  if (profile?.id) externalOrgId = profile.id;
  if (profile?.name) orgName = profile.name;

  if (!externalOrgId) {
    // 联调兜底：用 token 派生稳定 external id，避免阻塞
    externalOrgId = `baige_${createHash("sha256")
      .update(token.access_token)
      .digest("hex")
      .slice(0, 16)}`;
  }

  const expiresIn = Number(token.expires_in);
  const connection = await upsertBaigeConnection({
    orgId: parsed.orgId,
    externalOrgId,
    linkedByUserId: parsed.userId,
    scopes: token.scope?.split(/\s+/).filter(Boolean),
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    tokenExpiresAt: Number.isFinite(expiresIn)
      ? new Date(Date.now() + expiresIn * 1000)
      : null,
    metadata: orgName ? { externalOrgName: orgName } : null,
  });

  return { connection, orgId: parsed.orgId };
}

/** 开发/联调：不经过百格 OAuth，直接绑定 externalOrgId */
export async function linkBaigeConnectionDev(input: {
  orgId: string;
  userId: string;
  externalOrgId: string;
  externalOrgName?: string;
}) {
  return upsertBaigeConnection({
    orgId: input.orgId,
    externalOrgId: input.externalOrgId,
    linkedByUserId: input.userId,
    metadata: input.externalOrgName
      ? { externalOrgName: input.externalOrgName, linkedVia: "dev" }
      : { linkedVia: "dev" },
  });
}
