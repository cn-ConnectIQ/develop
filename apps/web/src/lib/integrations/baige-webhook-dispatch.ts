import { prisma, WebhookStatus, type Prisma } from "@connectiq/database";
import { ingestBaigeCheckin } from "@/lib/integrations/baige-checkin-sync";
import { syncBaigeCollectionPoints } from "@/lib/integrations/baige-stamp-sync";
import { syncBaigeParticipants } from "@/lib/integrations/baige-sync";
import {
  getBaigeConnectionByExternalOrgId,
  revokeBaigeConnection,
} from "@/lib/integrations/baige-connection-service";
import { BAIGE_EVENT_ID_KEY } from "@/lib/integrations/baige-partner-constants";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function pickString(obj: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return null;
}

async function resolveEventIdFromPayload(payload: Record<string, unknown>) {
  const eventId = pickString(payload, ["eventId", "event_id", "jiuli_event_id"]);
  if (eventId) return eventId;
  const baigeEventId = pickString(payload, [
    "baigeEventId",
    "baige_event_id",
    "external_event_id",
  ]);
  if (!baigeEventId) return null;

  const byRef = await prisma.event.findFirst({
    where: { externalRefId: baigeEventId },
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
  return setting?.eventId ?? null;
}

export async function dispatchBaigeWebhook(input: {
  eventType: string;
  payload: Record<string, unknown>;
  raw?: unknown;
}) {
  const log = await prisma.webhookLog.create({
    data: {
      source: `baige:${input.eventType || "unknown"}`,
      payload: (input.raw ?? input.payload) as Prisma.InputJsonValue,
      status: WebhookStatus.RECEIVED,
    },
  });

  try {
    const type = input.eventType.trim().toLowerCase();
    const payload = input.payload;
    let result: unknown = null;

    if (
      type === "registration.created" ||
      type === "registration.updated" ||
      type === "registration.cancelled" ||
      type === "attendees.changed"
    ) {
      const eventId = await resolveEventIdFromPayload(payload);
      if (!eventId) throw new Error("webhook 缺少可解析的活动 ID");
      result = await syncBaigeParticipants(eventId);
    } else if (type === "checkin.created" || type === "checkin.updated") {
      result = await ingestBaigeCheckin({
        eventId: pickString(payload, ["eventId", "event_id"]),
        baigeEventId: pickString(payload, [
          "baigeEventId",
          "baige_event_id",
          "external_event_id",
        ]),
        phone: pickString(payload, ["phone", "mobile"]),
        participantId: pickString(payload, ["participantId", "participant_id"]),
        registrationId: pickString(payload, [
          "registrationId",
          "registration_id",
        ]),
        checkedAt: pickString(payload, ["checkedAt", "checked_at", "checked_in_at"]),
        baigeCheckinId: pickString(payload, ["checkinId", "checkin_id", "id"]),
      });
    } else if (
      type === "collection_point.updated" ||
      type === "collection_points.updated" ||
      type === "stamps.updated"
    ) {
      const pointsRaw = payload.points ?? payload.collection_points ?? [];
      const points = Array.isArray(pointsRaw)
        ? pointsRaw.map((item, index) => {
            const row = asRecord(item);
            return {
              pointId:
                pickString(row, ["pointId", "point_id", "id"]) || `point_${index}`,
              name: pickString(row, ["name", "title"]) || `采集点${index + 1}`,
              location: pickString(row, ["location", "place"]),
              sortOrder:
                typeof row.sortOrder === "number"
                  ? row.sortOrder
                  : typeof row.sort_order === "number"
                    ? row.sort_order
                    : index,
              scanCode: pickString(row, ["scanCode", "scan_code", "qr"]),
            };
          })
        : [];
      result = await syncBaigeCollectionPoints({
        eventId: pickString(payload, ["eventId", "event_id"]),
        baigeEventId: pickString(payload, [
          "baigeEventId",
          "baige_event_id",
          "external_event_id",
        ]),
        points,
      });
    } else if (
      type === "authorization.revoked" ||
      type === "connection.revoked"
    ) {
      const externalOrgId = pickString(payload, [
        "baigeOrgId",
        "baige_org_id",
        "external_org_id",
        "org_id",
      ]);
      if (!externalOrgId) throw new Error("缺少 baigeOrgId");
      const conn = await getBaigeConnectionByExternalOrgId(externalOrgId);
      if (conn) {
        result = await revokeBaigeConnection(conn.orgId);
      } else {
        result = { skipped: true };
      }
    } else {
      result = { ignored: true, eventType: input.eventType };
    }

    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: WebhookStatus.PROCESSED,
        processedAt: new Date(),
        payload: {
          ...(asRecord(input.raw ?? input.payload)),
          _result: result as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      },
    });

    return { logId: log.id, status: "PROCESSED" as const, result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "处理失败";
    await prisma.webhookLog.update({
      where: { id: log.id },
      data: {
        status: WebhookStatus.FAILED,
        processedAt: new Date(),
        payload: {
          ...(asRecord(input.raw ?? input.payload)),
          _error: message,
        } as Prisma.InputJsonValue,
      },
    });
    throw err;
  }
}
