import { DataSource, prisma } from "@connectiq/database";
import type { PartnerParticipantAdapter, PartnerRegistrationRow } from "@/lib/partner-sync/types";
import { BAIGE_PROVIDER } from "@/lib/integrations/baige-partner-constants";

const BAIGE_BASE = process.env.BAIGE_API_URL ?? "https://open.baige.co/api/v1";

type BaigeRegistration = Record<string, unknown>;

function pickString(obj: BaigeRegistration, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

async function resolveAuth(orgId: string): Promise<{ token: string } | null> {
  const connection = await prisma.partnerConnection.findUnique({
    where: { provider_orgId: { provider: BAIGE_PROVIDER, orgId } },
  });
  if (connection?.accessToken) return { token: connection.accessToken };
  if (process.env.BAIGE_API_KEY) return { token: process.env.BAIGE_API_KEY };
  return null;
}

async function fetchRegistrations(
  externalEventId: string,
  auth: { token: string } | null,
): Promise<BaigeRegistration[]> {
  if (!auth) {
    if (process.env.BAIGE_DEV_MOCK === "true") {
      return [
        {
          id: "mock-reg-1",
          name: "百格测试用户",
          mobile: "13900000099",
          email: "baige-mock@example.com",
          company: "百格科技",
          job_title: "测试职位",
          status: "confirmed",
        },
      ];
    }
    throw new Error(
      "未找到可用的百格访问凭证。请先完成组织授权绑定，或设置 BAIGE_API_KEY，或设置 BAIGE_DEV_MOCK=true 用于开发测试。",
    );
  }

  const res = await fetch(
    `${BAIGE_BASE}/events/${encodeURIComponent(externalEventId)}/registrations`,
    {
      headers: {
        Authorization: `Bearer ${auth.token}`,
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

function mapRegistration(raw: unknown): PartnerRegistrationRow | null {
  const reg = raw as BaigeRegistration;
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
    externalId:
      pickString(reg, ["id", "registration_id", "registrationId", "reg_id"]) ?? null,
    externalStatus:
      pickString(reg, ["status", "registration_status", "state"]) ?? null,
    name,
    phone,
    email: pickString(reg, ["email", "mail", "email_address"]),
    company: pickString(reg, ["company", "organization", "org_name", "company_name"]),
    jobTitle: pickString(reg, ["job_title", "jobTitle", "title", "position"]),
  };
}

export const baigeParticipantAdapter: PartnerParticipantAdapter = {
  provider: BAIGE_PROVIDER,
  dataSource: DataSource.BAGEVENT,
  resolveAuth,
  fetchRegistrations,
  mapRegistration,
};
