import { prisma } from "@connectiq/database";
import type { ImportRow } from "@/lib/participants";
import { upsertParticipantsFromRows } from "@/lib/participant-import-service";

const BAIGE_PROVIDER = "baige";
const BAIGE_BASE = process.env.BAIGE_API_URL ?? "https://open.baige.co/api/v1";

type BaigeRegistration = Record<string, unknown>;

export type BaigeSyncResult = {
  synced_at: string;
  provider: string;
  created: number;
  updated: number;
  skipped: number;
  fetched: number;
  message: string;
};

function isDevMode() {
  return !process.env.BAIGE_API_KEY;
}

function pickString(obj: BaigeRegistration, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

function mapRegistrationToRow(reg: BaigeRegistration): ImportRow | null {
  const name = pickString(reg, ["name", "real_name", "realName", "attendee_name"]);
  const phone = pickString(reg, [
    "phone",
    "mobile",
    "cellphone",
    "phone_number",
    "mobile_phone",
  ]);
  if (!name || !phone) return null;

  return {
    name,
    phone,
    email: pickString(reg, ["email", "mail", "email_address"]),
    company: pickString(reg, ["company", "organization", "org_name", "company_name"]),
    jobTitle: pickString(reg, ["job_title", "jobTitle", "title", "position"]),
  };
}

async function resolveBaigeEventId(eventId: string): Promise<string | null> {
  const [setting, external] = await Promise.all([
    prisma.eventSetting.findUnique({
      where: { eventId_key: { eventId, key: "baige_event_id" } },
    }),
    prisma.externalSync.findUnique({
      where: { eventId_provider: { eventId, provider: BAIGE_PROVIDER } },
    }),
  ]);

  if (typeof setting?.value === "string" && setting.value.trim()) {
    return setting.value.trim();
  }

  if (external?.syncConfig && typeof external.syncConfig === "object") {
    const cfg = external.syncConfig as Record<string, unknown>;
    const externalEventId = cfg.externalEventId ?? cfg.external_event_id;
    if (typeof externalEventId === "string" && externalEventId.trim()) {
      return externalEventId.trim();
    }
  }

  return null;
}

async function fetchBaigeRegistrations(
  baigeEventId: string,
): Promise<BaigeRegistration[]> {
  if (isDevMode()) {
    if (process.env.BAIGE_DEV_MOCK === "true") {
      return [
        {
          name: "百格测试用户",
          mobile: "13900000099",
          email: "baige-mock@example.com",
          company: "百格科技",
          job_title: "测试职位",
        },
      ];
    }
    throw new Error(
      "未配置 BAIGE_API_KEY。请在环境变量中设置百格 API 密钥，或设置 BAIGE_DEV_MOCK=true 用于开发测试。",
    );
  }

  const res = await fetch(
    `${BAIGE_BASE}/events/${encodeURIComponent(baigeEventId)}/registrations`,
    {
      headers: {
        Authorization: `Bearer ${process.env.BAIGE_API_KEY}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `百格 API 请求失败 (${res.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
    );
  }

  const json = (await res.json()) as
    | BaigeRegistration[]
    | { data?: BaigeRegistration[]; registrations?: BaigeRegistration[] };

  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.registrations)) return json.registrations;
  return [];
}

export async function syncBaigeParticipants(
  eventId: string,
): Promise<BaigeSyncResult> {
  const baigeEventId = await resolveBaigeEventId(eventId);
  if (!baigeEventId) {
    throw new Error(
      "未配置百格活动 ID。请在活动设置中写入 baige_event_id，或在 external_syncs（provider=baige）的 syncConfig.externalEventId 中配置。",
    );
  }

  const registrations = await fetchBaigeRegistrations(baigeEventId);
  const rows = registrations
    .map(mapRegistrationToRow)
    .filter((row): row is ImportRow => row !== null);

  const result = await upsertParticipantsFromRows(eventId, rows, {
    skipDuplicates: false,
  });

  const now = new Date().toISOString();
  await prisma.eventSetting.upsert({
    where: { eventId_key: { eventId, key: "baige_last_sync_at" } },
    create: { eventId, key: "baige_last_sync_at", value: now },
    update: { value: now },
  });

  const totalChanged = result.created + result.updated;
  return {
    synced_at: now,
    provider: BAIGE_PROVIDER,
    fetched: registrations.length,
    ...result,
    message:
      totalChanged > 0
        ? `已从百格同步 ${registrations.length} 条报名，新增 ${result.created}、更新 ${result.updated}、跳过 ${result.skipped}`
        : registrations.length > 0
          ? `百格返回 ${registrations.length} 条，无有效手机号可导入（跳过 ${result.skipped}）`
          : "百格侧暂无报名数据",
  };
}
