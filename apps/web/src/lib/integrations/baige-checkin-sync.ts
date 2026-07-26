import { prisma } from "@connectiq/database";
import {
  BAIGE_EVENT_ID_KEY,
  BAIGE_PROVIDER,
} from "@/lib/integrations/baige-partner-constants";

export class BaigeCheckinSyncError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function resolveEventId(input: {
  eventId?: string | null;
  baigeEventId?: string | null;
}) {
  if (input.eventId) return input.eventId;
  const baigeEventId = input.baigeEventId?.trim();
  if (!baigeEventId) {
    throw new BaigeCheckinSyncError("缺少 eventId / baigeEventId", "VALIDATION");
  }

  const byRef = await prisma.event.findFirst({
    where: { externalRefId: baigeEventId, dataSource: "BAGEVENT" },
    select: { id: true },
  });
  if (byRef) return byRef.id;

  const setting = await prisma.eventSetting.findFirst({
    where: {
      key: BAIGE_EVENT_ID_KEY,
      value: { equals: baigeEventId },
    },
    select: { eventId: true },
  });
  if (setting) return setting.eventId;

  throw new BaigeCheckinSyncError("未找到对应玖莅活动", "EVENT_NOT_FOUND");
}

async function resolveParticipantId(input: {
  eventId: string;
  participantId?: string | null;
  phone?: string | null;
  registrationId?: string | null;
}) {
  if (input.participantId) {
    const row = await prisma.participant.findFirst({
      where: { id: input.participantId, eventId: input.eventId },
      select: { id: true },
    });
    if (row) return row.id;
  }

  const registrationId = input.registrationId?.trim();
  if (registrationId) {
    const registration = await prisma.participantRegistration.findUnique({
      where: {
        provider_externalId: { provider: BAIGE_PROVIDER, externalId: registrationId },
      },
      select: { participantId: true },
    });
    if (registration) return registration.participantId;
  }

  const phone = input.phone?.trim();
  if (phone) {
    const row = await prisma.participant.findFirst({
      where: { eventId: input.eventId, phone },
      select: { id: true },
    });
    if (row) return row.id;
  }

  // 兼容迁移期未回填的历史数据：registrationId 曾暂存于 tags：baige_reg:<id>
  if (registrationId) {
    const row = await prisma.participant.findFirst({
      where: {
        eventId: input.eventId,
        tags: { has: `baige_reg:${registrationId}` },
      },
      select: { id: true },
    });
    if (row) return row.id;
  }

  throw new BaigeCheckinSyncError("未找到对应参会人", "PARTICIPANT_NOT_FOUND");
}

/** 百格 → 玖莅：写入 CheckIn（幂等） */
export async function ingestBaigeCheckin(input: {
  eventId?: string | null;
  baigeEventId?: string | null;
  participantId?: string | null;
  phone?: string | null;
  registrationId?: string | null;
  checkedAt?: string | null;
  baigeCheckinId?: string | null;
}) {
  const eventId = await resolveEventId(input);
  const participantId = await resolveParticipantId({
    eventId,
    participantId: input.participantId,
    phone: input.phone,
    registrationId: input.registrationId,
  });

  const checkedInAt = input.checkedAt ? new Date(input.checkedAt) : new Date();
  const method = input.baigeCheckinId
    ? `baige:${input.baigeCheckinId}`
    : "baige";

  try {
    const row = await prisma.checkIn.create({
      data: {
        eventId,
        participantId,
        method: method.slice(0, 64),
        checkedInAt:
          checkedInAt && !Number.isNaN(checkedInAt.getTime())
            ? checkedInAt
            : new Date(),
      },
    });
    return { checkInId: row.id, eventId, participantId, created: true };
  } catch (err) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      const existing = await prisma.checkIn.findUnique({
        where: {
          eventId_participantId: { eventId, participantId },
        },
      });
      return {
        checkInId: existing?.id ?? null,
        eventId,
        participantId,
        created: false,
      };
    }
    throw err;
  }
}

/** 玖莅 → 百格：现场签到回写（配置了 accessToken 才真正发送） */
export async function pushCheckinToBaige(input: {
  eventId: string;
  participantId: string;
  checkedAt?: Date;
}) {
  const [event, participant, sync] = await Promise.all([
    prisma.event.findUnique({
      where: { id: input.eventId },
      select: { id: true, orgId: true, externalRefId: true, dataSource: true },
    }),
    prisma.participant.findUnique({
      where: { id: input.participantId },
      select: { id: true, phone: true, name: true },
    }),
    prisma.externalSync.findUnique({
      where: {
        eventId_provider: { eventId: input.eventId, provider: BAIGE_PROVIDER },
      },
    }),
  ]);

  if (!event || event.dataSource !== "BAGEVENT") {
    return { pushed: false, reason: "not_baige_event" as const };
  }

  const connection = await prisma.partnerConnection.findUnique({
    where: {
      provider_orgId: { provider: BAIGE_PROVIDER, orgId: event.orgId },
    },
  });
  if (!connection?.accessToken) {
    return { pushed: false, reason: "no_token" as const };
  }

  const baigeEventId =
    event.externalRefId ||
    (sync?.syncConfig &&
    typeof sync.syncConfig === "object" &&
    typeof (sync.syncConfig as Record<string, unknown>).externalEventId ===
      "string"
      ? String((sync.syncConfig as Record<string, unknown>).externalEventId)
      : null);

  if (!baigeEventId) {
    return { pushed: false, reason: "missing_baige_event_id" as const };
  }

  const apiBase =
    process.env.BAIGE_API_URL?.trim() || "https://open.baige.co/api/v1";

  try {
    const res = await fetch(
      `${apiBase}/events/${encodeURIComponent(baigeEventId)}/checkins`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${connection.accessToken}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `jiuli-${input.eventId}-${input.participantId}`,
        },
        body: JSON.stringify({
          phone: participant?.phone ?? undefined,
          name: participant?.name ?? undefined,
          checked_at: (input.checkedAt ?? new Date()).toISOString(),
          source: "jiuli",
        }),
      },
    );
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn("[baige-checkin] push failed", res.status, text);
      return { pushed: false, reason: "upstream_error" as const };
    }
    return { pushed: true as const };
  } catch (err) {
    console.warn("[baige-checkin] push error", err);
    return { pushed: false, reason: "network_error" as const };
  }
}
