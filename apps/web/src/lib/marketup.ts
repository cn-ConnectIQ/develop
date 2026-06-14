import type { MarketupFieldMap, MarketupSyncConfig } from "@/types/booth";
import type { MarketupAutomationType } from "@/lib/marketup-config";

const MARKETUP_BASE =
  process.env.MARKETUP_API_URL ?? "https://api.marketup.cn/v1";

export type ContactPayload = Record<string, string | number | undefined>;

export type MarketupContactResult = {
  id: string;
  dev?: boolean;
};

export type MarketupLeadResult = {
  id: string;
  dev?: boolean;
};

function isDevMode() {
  return !process.env.MARKETUP_API_KEY;
}

function authHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.MARKETUP_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function parseResponse<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `MarketUP ${action} failed (${res.status})${text ? `: ${text}` : ""}`,
    );
  }
  return res.json() as Promise<T>;
}

export async function createContact(
  data: ContactPayload,
): Promise<MarketupContactResult> {
  if (isDevMode()) {
    console.info("[MarketUP DEV] createContact", data);
    return { id: `dev_contact_${Date.now()}`, dev: true };
  }

  const res = await fetch(`${MARKETUP_BASE}/contacts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return parseResponse(res, "createContact");
}

export async function upsertContact(
  phone: string,
  data: ContactPayload,
): Promise<MarketupContactResult> {
  if (isDevMode()) {
    console.info("[MarketUP DEV] upsertContact", phone, data);
    return { id: `dev_contact_${phone}`, dev: true };
  }

  const res = await fetch(`${MARKETUP_BASE}/contacts/upsert`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ phone, ...data }),
  });
  return parseResponse(res, "upsertContact");
}

export async function createLead(
  contactId: string,
  data: ContactPayload,
): Promise<MarketupLeadResult> {
  if (isDevMode()) {
    console.info("[MarketUP DEV] createLead", contactId, data);
    return { id: `dev_lead_${Date.now()}`, dev: true };
  }

  const res = await fetch(`${MARKETUP_BASE}/leads`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ contactId, ...data }),
  });
  return parseResponse(res, "createLead");
}

export async function triggerAutomation(
  type: MarketupAutomationType,
  data: Record<string, string>,
): Promise<{ ok: boolean; dev?: boolean }> {
  if (isDevMode()) {
    console.info("[MarketUP DEV] triggerAutomation", type, data);
    return { ok: true, dev: true };
  }

  const res = await fetch(`${MARKETUP_BASE}/automations/trigger`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ type, ...data }),
  });
  if (!res.ok) {
    throw new Error(`MarketUP triggerAutomation failed (${res.status})`);
  }
  return { ok: true };
}

/** ConnectIQ 源字段 → MarketUP 目标字段名 */
export function mapFieldsToMarketup(
  source: Record<string, unknown>,
  fieldMap: MarketupFieldMap,
): ContactPayload {
  const result: ContactPayload = {};
  for (const [sourceKey, targetKey] of Object.entries(fieldMap)) {
    const value = source[sourceKey];
    if (value != null && value !== "" && targetKey) {
      result[targetKey] = String(value);
    }
  }
  return result;
}

export function resolveWriteStrategy(config: MarketupSyncConfig) {
  return config.writeStrategy ?? "upsert";
}

export type { MarketupSyncConfig };
