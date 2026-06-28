import { prisma } from "@connectiq/database";

const BAIGE_PROVIDER = "baige";

export function isBaigeEnvConfigured() {
  return (
    !!process.env.BAIGE_API_KEY || process.env.BAIGE_DEV_MOCK === "true"
  );
}

export async function isBaigePlatformConnected() {
  if (isBaigeEnvConfigured()) return true;

  const row = await prisma.platformIntegration.findUnique({
    where: { provider: BAIGE_PROVIDER },
  });

  if (!row) return false;

  const syncConfig =
    row.syncConfig && typeof row.syncConfig === "object"
      ? (row.syncConfig as Record<string, unknown>)
      : null;

  const apiKey =
    syncConfig?.apiKey ?? syncConfig?.api_key ?? syncConfig?.accessToken;
  return typeof apiKey === "string" && apiKey.trim().length > 0;
}

export async function getBaigeConnectionStatus() {
  const connected = await isBaigePlatformConnected();
  return {
    connected,
    source: connected
      ? isBaigeEnvConfigured()
        ? ("env" as const)
        : ("platform" as const)
      : null,
  };
}
