export const BAIGE_PROVIDER = "baige";

export const BAIGE_DEFAULT_SCOPES = [
  "org.profile",
  "events.read",
  "events.interact",
  "attendees.read",
  "checkin.read",
  "checkin.write",
  "stamps.read",
] as const;

export const BAIGE_STAMP_RALLY_NAME = "百格采集点";
export const BAIGE_STAMP_MAP_KEY = "baige_stamp_map";
export const BAIGE_EVENT_ID_KEY = "baige_event_id";
export const BAIGE_LAST_SYNC_KEY = "baige_last_sync_at";

export function getBaigeOAuthConfig() {
  return {
    clientId: process.env.BAIGE_OAUTH_CLIENT_ID?.trim() || "",
    clientSecret: process.env.BAIGE_OAUTH_CLIENT_SECRET?.trim() || "",
    authorizeUrl:
      process.env.BAIGE_OAUTH_AUTHORIZE_URL?.trim() ||
      "https://open.baige.co/oauth/authorize",
    tokenUrl:
      process.env.BAIGE_OAUTH_TOKEN_URL?.trim() ||
      "https://open.baige.co/oauth/token",
    redirectUri:
      process.env.BAIGE_OAUTH_REDIRECT_URI?.trim() ||
      "https://9li.co/uc/api/partner/baige/oauth/callback",
    apiBase:
      process.env.BAIGE_API_URL?.trim() || "https://open.baige.co/api/v1",
  };
}

export function isBaigeOAuthConfigured() {
  const cfg = getBaigeOAuthConfig();
  return Boolean(cfg.clientId && cfg.clientSecret);
}

export function getBaigeWebhookSecret() {
  return (
    process.env.BAIGE_WEBHOOK_SECRET?.trim() ||
    process.env.BAIGE_PARTNER_API_KEY?.trim() ||
    ""
  );
}

export function getBaigePartnerApiKey() {
  return (
    process.env.BAIGE_PARTNER_API_KEY?.trim() ||
    process.env.BAIGE_WEBHOOK_SECRET?.trim() ||
    ""
  );
}

export function isBaigePartnerDevMode() {
  return (
    process.env.BAIGE_PARTNER_DEV_MOCK === "true" ||
    process.env.BAIGE_DEV_MOCK === "true" ||
    (!getBaigePartnerApiKey() && process.env.NODE_ENV !== "production")
  );
}
