import {
  DataSource,
  EventStatus,
  LotteryStatus,
  PartnerConnectionStatus,
  PollStatus,
  PollType,
  prisma,
  type Prisma,
} from "@connectiq/database";
import { getAppBaseUrl } from "@/lib/supabase/server";
import {
  BAIGE_APP_SCOPES,
  BAIGE_EVENT_ID_KEY,
  BAIGE_MODULES_SETTING_KEY,
  BAIGE_PARTNER_HOST,
  BAIGE_PROVIDER,
} from "@/lib/integrations/baige-partner-constants";
import {
  BaigeConnectionError,
  getBaigeConnectionByExternalOrgId,
  revokeBaigeConnection,
  upsertBaigeConnection,
} from "@/lib/integrations/baige-connection-service";
import {
  mergeEventFeatureFlags,
  parseEventFeatureFlags,
  type EventFeatureFlagKey,
} from "@/lib/event-feature-flags";
import { withPublicPath } from "@/lib/public-path";
import { linkBaigeIdentityToOrg, provisionBaigeOrgAndOwner } from "@/lib/integrations/baige-identity-link";
import type { BaigeIdentityInput } from "@/lib/integrations/baige-identity-link";
import { cacheSet } from "@/lib/redis";
import { randomBytes } from "crypto";

export type BaigeAppPhase = "ongoing" | "registering" | "ended";

export type BaigeAppModuleId =
  | "lottery"
  | "vote"
  | "ai_match"
  | "checkin_wall"
  | "qa"
  | "danmaku";

export type BaigeAppConnectionView = {
  linked: boolean;
  status?: "ACTIVE" | "PENDING" | "REVOKED";
  partnerHost?: string;
  jiuliOrgId?: string;
  jiuliOrgName?: string;
  authorizedAt?: string;
  scopes?: string[];
  baigeOrgId?: string;
};

type SoftModuleState = Partial<Record<BaigeAppModuleId, boolean>>;

const SOFT_MODULE_DEFAULTS: SoftModuleState = {
  vote: true,
  qa: true,
  checkin_wall: true,
  danmaku: false,
};

type ModuleDef = {
  id: BaigeAppModuleId;
  title: string;
  /** 映射到 Event.featureFlags */
  flagKey?: EventFeatureFlagKey;
  /** 无 featureFlag 时落在 EventSetting */
  soft?: boolean;
  managePath: (eventId: string) => string;
};

const MODULE_DEFS: ModuleDef[] = [
  {
    id: "lottery",
    title: "大屏抽奖",
    flagKey: "lottery",
    managePath: (eventId) => `/events/${eventId}/lottery`,
  },
  {
    id: "vote",
    title: "投票互动",
    soft: true,
    managePath: (eventId) => `/events/${eventId}/interactions`,
  },
  {
    id: "qa",
    title: "问答互动",
    soft: true,
    managePath: (eventId) => `/events/${eventId}/interactions`,
  },
  {
    id: "ai_match",
    title: "AI 匹配",
    flagKey: "aiReferral",
    managePath: (eventId) => `/events/${eventId}/matchmaking`,
  },
  {
    id: "checkin_wall",
    title: "签到墙",
    soft: true,
    managePath: (eventId) => `/events/${eventId}/screen`,
  },
  {
    id: "danmaku",
    title: "弹幕",
    soft: true,
    managePath: (eventId) => `/events/${eventId}/interactions`,
  },
];

function absoluteManageUrl(path: string): string {
  const base = getAppBaseUrl().replace(/\/$/, "");
  const prefixed = withPublicPath(path);
  try {
    const origin = new URL(base).origin;
    return `${origin}${prefixed}`;
  } catch {
    return `${base}${prefixed.startsWith("/") ? prefixed : `/${prefixed}`}`;
  }
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function formatDateShort(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
}

export function resolveBaigeAppPhase(input: {
  status: EventStatus;
  startDate: Date | null;
  endDate: Date | null;
  now?: Date;
}): BaigeAppPhase {
  const now = input.now ?? new Date();
  if (input.status === EventStatus.ARCHIVED) return "ended";
  if (input.endDate && input.endDate.getTime() < now.getTime()) return "ended";
  if (input.status === EventStatus.LIVE) return "ongoing";
  if (
    input.startDate &&
    input.startDate.getTime() <= now.getTime() &&
    (!input.endDate || input.endDate.getTime() >= now.getTime())
  ) {
    return "ongoing";
  }
  return "registering";
}

export function formatWhenWhere(input: {
  startDate: Date | null;
  endDate: Date | null;
  location: string | null;
}): string {
  const start = formatDateShort(input.startDate);
  const end = formatDateShort(input.endDate);
  let when = "";
  if (start && end && start !== end) when = `${start}–${end}`;
  else when = start || end || "";
  const where = input.location?.trim() || "";
  if (when && where) return `${when} · ${where}`;
  return when || where || "";
}

export function normalizeBaigeAppScopes(scopes?: string[] | null): string[] {
  if (scopes?.length) {
    const allowed = new Set<string>(BAIGE_APP_SCOPES);
    const filtered = scopes.map((s) => s.trim()).filter((s) => allowed.has(s));
    if (filtered.length > 0) return [...new Set(filtered)];
  }
  return [...BAIGE_APP_SCOPES];
}

export async function formatBaigeAppConnection(
  externalOrgId: string,
): Promise<BaigeAppConnectionView> {
  const row = await getBaigeConnectionByExternalOrgId(externalOrgId);
  if (!row || row.status === PartnerConnectionStatus.REVOKED) {
    return { linked: false };
  }

  const org = await prisma.organization.findUnique({
    where: { id: row.orgId },
    select: { id: true, name: true },
  });

  return {
    linked: row.status === PartnerConnectionStatus.ACTIVE,
    status: row.status,
    partnerHost: BAIGE_PARTNER_HOST,
    jiuliOrgId: row.orgId,
    jiuliOrgName: org?.name ?? undefined,
    authorizedAt: row.createdAt.toISOString(),
    scopes: row.scopes?.length ? row.scopes : [...BAIGE_APP_SCOPES],
    baigeOrgId: row.externalOrgId,
  };
}

export async function requireActiveBaigeConnection(baigeOrgId: string) {
  const trimmed = baigeOrgId.trim();
  if (!trimmed) {
    throw new BaigeConnectionError("缺少 baigeOrgId", "VALIDATION");
  }
  const row = await getBaigeConnectionByExternalOrgId(trimmed);
  if (!row || row.status !== PartnerConnectionStatus.ACTIVE) {
    throw new BaigeConnectionError("百格组织未绑定玖莅", "NOT_LINKED");
  }
  return row;
}

export async function revokeBaigeAppConnection(baigeOrgId: string) {
  const row = await requireActiveBaigeConnection(baigeOrgId);
  return revokeBaigeConnection(row.orgId);
}

/** 伙伴侧发起授权：优先一键绑定；无组织时按邮箱/手机自动创建账号与组织 */
export async function startBaigeAppAuthorize(input: {
  baigeOrgId: string;
  baigeUserId?: string;
  email?: string;
  phone?: string;
  name?: string;
  orgName?: string;
  scopes?: string[];
  redirectUri?: string;
  /** 若已知玖莅组织且允许直连，可一键绑定 */
  jiuliOrgId?: string;
}) {
  const scopes = normalizeBaigeAppScopes(input.scopes);
  const identity: BaigeIdentityInput = {
    baigeUserId: input.baigeUserId,
    email: input.email,
    phone: input.phone,
    name: input.name,
    orgName: input.orgName,
  };

  const baigeUserId = identity.baigeUserId?.trim() || null;
  const hasContact = Boolean(identity.email || identity.phone);
  /** 自动开户：必须 (email|phone) + baigeUserId；仅 baigeUserId 不够 */
  const canAutoProvision = Boolean(baigeUserId && hasContact);
  const hasIdentity = Boolean(hasContact || baigeUserId);

  async function bindToOrg(orgId: string) {
    const connection = await upsertBaigeConnection({
      orgId,
      externalOrgId: input.baigeOrgId.trim(),
      scopes,
      metadata: {
        source: "baige_app",
        baigeUserId: input.baigeUserId ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        orgName: input.orgName ?? null,
      },
    });
    let linkedUserId: string | null = null;
    if (hasIdentity) {
      linkedUserId = await linkBaigeIdentityToOrg({
        orgId: connection.orgId,
        identity,
      });
    }
    return {
      mode: "linked" as const,
      connection: await formatBaigeAppConnection(connection.externalOrgId),
      linkedUserId,
      orgCreated: false as boolean,
    };
  }

  if (input.jiuliOrgId?.trim()) {
    return bindToOrg(input.jiuliOrgId.trim());
  }

  const existing = await getBaigeConnectionByExternalOrgId(input.baigeOrgId);
  if (existing?.status === PartnerConnectionStatus.ACTIVE) {
    const result = await bindToOrg(existing.orgId);
    return result;
  }

  // 首次授权：仅 (email|phone) + baigeUserId 自动开户；缺联系方式 → authorizeUrl
  if (canAutoProvision) {
    const provisioned = await provisionBaigeOrgAndOwner({
      baigeOrgId: input.baigeOrgId,
      identity,
    });
    const connection = await upsertBaigeConnection({
      orgId: provisioned.orgId,
      externalOrgId: input.baigeOrgId.trim(),
      linkedByUserId: provisioned.userId,
      scopes,
      metadata: {
        source: "baige_app_auto_provision",
        baigeUserId: input.baigeUserId ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        orgName: input.orgName ?? null,
      },
    });
    return {
      mode: "linked" as const,
      connection: await formatBaigeAppConnection(connection.externalOrgId),
      linkedUserId: provisioned.userId,
      orgCreated: provisioned.orgCreated,
    };
  }

  // 缺 email 且缺 phone（或无 baigeUserId）→ 管理员确认页
  const state = randomBytes(24).toString("hex");
  await cacheSet(
    `baige-app-authorize:${state}`,
    JSON.stringify({
      baigeOrgId: input.baigeOrgId.trim(),
      baigeUserId: input.baigeUserId ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      name: input.name ?? null,
      orgName: input.orgName ?? null,
      scopes,
      redirectUri: input.redirectUri ?? null,
    }),
    600,
  );

  const authorizeUrl = absoluteManageUrl(
    `/integrations/baige?partner_state=${encodeURIComponent(state)}`,
  );

  return { mode: "authorize" as const, authorizeUrl, state };
}

async function listAuthorizedBaigeEvents(orgId: string) {
  return prisma.event.findMany({
    where: {
      orgId,
      OR: [
        { dataSource: DataSource.BAGEVENT },
        { externalSyncs: { some: { provider: BAIGE_PROVIDER } } },
        { settings: { some: { key: BAIGE_EVENT_ID_KEY } } },
      ],
    },
    select: {
      id: true,
      name: true,
      status: true,
      location: true,
      startDate: true,
      endDate: true,
      featureFlags: true,
      externalRefId: true,
      settings: {
        where: { key: { in: [BAIGE_EVENT_ID_KEY, BAIGE_MODULES_SETTING_KEY] } },
        select: { key: true, value: true },
      },
      _count: {
        select: {
          participants: true,
          polls: true,
          lotteries: true,
        },
      },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });
}

function resolveBaigeEventId(
  event: Awaited<ReturnType<typeof listAuthorizedBaigeEvents>>[number],
): string {
  const fromSetting = event.settings.find((s) => s.key === BAIGE_EVENT_ID_KEY);
  const raw = fromSetting?.value;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (typeof raw === "number") return String(raw);
  return event.externalRefId?.trim() || event.id;
}

function readSoftModules(
  event: Awaited<ReturnType<typeof listAuthorizedBaigeEvents>>[number],
): SoftModuleState {
  const row = event.settings.find((s) => s.key === BAIGE_MODULES_SETTING_KEY);
  const value = row?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...SOFT_MODULE_DEFAULTS };
  }
  return { ...SOFT_MODULE_DEFAULTS, ...(value as SoftModuleState) };
}

function isModuleEnabled(
  def: ModuleDef,
  flags: ReturnType<typeof parseEventFeatureFlags>,
  soft: SoftModuleState,
): boolean {
  if (def.flagKey) return Boolean(flags[def.flagKey]);
  return soft[def.id] !== false;
}

async function loadInteractionCounts(eventId: string) {
  const [pollResponses, qnaPending, lotteryRounds, checkIns] =
    await Promise.all([
      prisma.pollResponse.count({ where: { poll: { eventId } } }),
      prisma.pollResponse.count({
        where: {
          poll: { eventId, type: PollType.QNA, status: PollStatus.LIVE },
        },
      }),
      prisma.lottery.count({
        where: {
          eventId,
          status: {
            in: [
              LotteryStatus.OPEN,
              LotteryStatus.DRAWING,
              LotteryStatus.READY,
              LotteryStatus.FINISHED,
            ],
          },
        },
      }),
      prisma.checkIn.count({ where: { eventId } }),
    ]);

  return { pollResponses, qnaPending, lotteryRounds, checkIns };
}

function collectEnabledFeatures(
  flags: ReturnType<typeof parseEventFeatureFlags>,
  soft: SoftModuleState,
): BaigeAppModuleId[] {
  return MODULE_DEFS.filter((def) => isModuleEnabled(def, flags, soft)).map(
    (d) => d.id,
  );
}

export async function getBaigeAppEventsOverview(input: {
  baigeOrgId: string;
  /** 百格侧已知活动 ID，用于计算 unconfiguredCount */
  knownBaigeEventIds?: string[];
}) {
  const connection = await requireActiveBaigeConnection(input.baigeOrgId);
  const connectionView = await formatBaigeAppConnection(connection.externalOrgId);
  const events = await listAuthorizedBaigeEvents(connection.orgId);

  const enabledEvents = await Promise.all(
    events.map(async (event) => {
      const baigeEventId = resolveBaigeEventId(event);
      const flags = parseEventFeatureFlags(event.featureFlags);
      const soft = readSoftModules(event);
      const counts = await loadInteractionCounts(event.id);
      return {
        baigeEventId,
        jiuliEventId: event.id,
        title: event.name,
        phase: resolveBaigeAppPhase(event),
        whenWhere: formatWhenWhere(event),
        features: collectEnabledFeatures(flags, soft),
        stats: {
          participants: event._count.participants,
          votes: counts.pollResponses,
          danmaku: 0,
        },
      };
    }),
  );

  const enabledIds = new Set(enabledEvents.map((e) => e.baigeEventId));
  let unconfiguredCount = 0;
  if (input.knownBaigeEventIds?.length) {
    unconfiguredCount = input.knownBaigeEventIds.filter(
      (id) => id.trim() && !enabledIds.has(id.trim()),
    ).length;
  }

  return {
    connection: connectionView,
    enabledEvents,
    unconfiguredCount,
    enabledCount: enabledEvents.length,
  };
}

async function findAuthorizedEventByBaigeId(
  orgId: string,
  baigeEventId: string,
) {
  const events = await listAuthorizedBaigeEvents(orgId);
  const hit = events.find((e) => resolveBaigeEventId(e) === baigeEventId.trim());
  if (!hit) {
    throw new BaigeConnectionError("活动未开通互动", "EVENT_NOT_AUTHORIZED");
  }
  return hit;
}

function moduleSubtitle(
  id: BaigeAppModuleId,
  counts: Awaited<ReturnType<typeof loadInteractionCounts>>,
  lotteryCount: number,
): string {
  switch (id) {
    case "lottery":
      return lotteryCount > 0 ? `已设 ${lotteryCount} 轮` : "未创建抽奖";
    case "vote":
      return counts.pollResponses > 0
        ? `${counts.pollResponses} 次投票`
        : "投票互动";
    case "qa":
      return counts.qnaPending > 0
        ? `${counts.qnaPending} 条提问`
        : "问答互动";
    case "ai_match":
      return "智能人脉匹配";
    case "checkin_wall":
      return counts.checkIns > 0
        ? `${counts.checkIns} 人已签到`
        : "签到展示";
    case "danmaku":
      return "弹幕互动";
    default:
      return "";
  }
}

export async function getBaigeAppEventInteraction(input: {
  baigeOrgId: string;
  baigeEventId: string;
}) {
  const connection = await requireActiveBaigeConnection(input.baigeOrgId);
  const event = await findAuthorizedEventByBaigeId(
    connection.orgId,
    input.baigeEventId,
  );
  const flags = parseEventFeatureFlags(event.featureFlags);
  const soft = readSoftModules(event);
  const counts = await loadInteractionCounts(event.id);
  const phase = resolveBaigeAppPhase(event);

  const modules = MODULE_DEFS.map((def) => {
    const enabled = isModuleEnabled(def, flags, soft);
    const badge =
      def.id === "qa" && counts.qnaPending > 0
        ? String(counts.qnaPending)
        : null;
    return {
      id: def.id,
      title: def.title,
      subtitle: moduleSubtitle(def.id, counts, event._count.lotteries),
      enabled,
      badge,
      manageUrl: absoluteManageUrl(def.managePath(event.id)),
    };
  });

  const totalInteractions =
    counts.pollResponses + counts.checkIns + event._count.lotteries;

  return {
    baigeEventId: resolveBaigeEventId(event),
    jiuliEventId: event.id,
    title: event.name,
    phase,
    modules,
    stats: {
      totalParticipants: event._count.participants,
      totalInteractions,
      peakTime: null as string | null,
    },
    reportUrl: absoluteManageUrl(`/events/${event.id}/reports`),
  };
}

export async function getBaigeAppEventInteractionStats(input: {
  baigeOrgId: string;
  baigeEventId: string;
}) {
  const detail = await getBaigeAppEventInteraction(input);
  return {
    baigeEventId: detail.baigeEventId,
    stats: detail.stats,
    modules: detail.modules.map((m) => ({
      id: m.id,
      enabled: m.enabled,
      badge: m.badge,
      subtitle: m.subtitle,
    })),
  };
}

async function assertModuleNotBusy(
  eventId: string,
  moduleId: BaigeAppModuleId,
  enabling: boolean,
) {
  if (enabling) return;
  if (moduleId === "lottery") {
    const busy = await prisma.lottery.findFirst({
      where: {
        eventId,
        status: { in: [LotteryStatus.DRAWING, LotteryStatus.OPEN] },
      },
      select: { id: true, title: true },
    });
    if (busy) {
      throw new BaigeConnectionError(
        `抽奖「${busy.title}」进行中，结束后再关闭`,
        "MODULE_BUSY",
      );
    }
  }
  if (moduleId === "vote" || moduleId === "qa") {
    const live = await prisma.poll.findFirst({
      where: {
        eventId,
        status: PollStatus.LIVE,
        ...(moduleId === "qa" ? { type: PollType.QNA } : {}),
      },
      select: { id: true, title: true },
    });
    if (live) {
      throw new BaigeConnectionError(
        `「${live.title}」进行中，结束后再关闭`,
        "MODULE_BUSY",
      );
    }
  }
}

export async function patchBaigeAppModule(input: {
  baigeOrgId: string;
  baigeEventId: string;
  moduleId: string;
  enabled: boolean;
}) {
  const def = MODULE_DEFS.find((m) => m.id === input.moduleId);
  if (!def) {
    throw new BaigeConnectionError("未知模块", "VALIDATION");
  }

  const connection = await requireActiveBaigeConnection(input.baigeOrgId);
  const event = await findAuthorizedEventByBaigeId(
    connection.orgId,
    input.baigeEventId,
  );

  await assertModuleNotBusy(event.id, def.id, input.enabled);

  if (def.flagKey) {
    const next = mergeEventFeatureFlags(event.featureFlags, {
      [def.flagKey]: input.enabled,
    });
    await prisma.event.update({
      where: { id: event.id },
      data: { featureFlags: next },
    });
  } else {
    const soft = readSoftModules(event);
    soft[def.id] = input.enabled;
    await prisma.eventSetting.upsert({
      where: {
        eventId_key: {
          eventId: event.id,
          key: BAIGE_MODULES_SETTING_KEY,
        },
      },
      create: {
        eventId: event.id,
        key: BAIGE_MODULES_SETTING_KEY,
        value: soft as Prisma.InputJsonValue,
      },
      update: { value: soft as Prisma.InputJsonValue },
    });
  }

  return getBaigeAppEventInteraction({
    baigeOrgId: input.baigeOrgId,
    baigeEventId: input.baigeEventId,
  });
}
