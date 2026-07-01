import {
  InviteStatus,
  OrgStaffRole,
  prisma,
} from "@connectiq/database";
import { ErrorCode, UserRole } from "@connectiq/types";
import QRCode from "qrcode";
import type { Session } from "next-auth";
import { ApiError, requireBoothAccess, type AuthSession } from "@/lib/api-auth";
import { resolveMobileUserId } from "@/lib/mobile-user-id";
import {
  getExhibitorDashboardStats,
  listExhibitorLeads,
} from "@/lib/exhibitor/dashboard-service";
import { computeLeadAiIntentLevel } from "@/lib/exhibitor/lead-intent-service";
import { resolveExhibitorBooth } from "@/lib/exhibitor/exhibitor-auth";

export type MobileBoothDashboard = {
  booth_id: string;
  booth_code: string;
  todayVisitors: number;
  aLeads: number;
  bLeads: number;
  cLeads: number;
  crmSyncedCount: number;
  recentLeads: Array<{
    id: string;
    visitor_user_id: string;
    name: string;
    company?: string;
    title?: string;
    visited_at: string;
    intent_level: "A" | "B" | "C";
    crm_status: "SYNCED" | "PENDING" | "FAILED";
  }>;
};

function mapIntentLevel(raw: string | null | undefined): "A" | "B" | "C" {
  const upper = String(raw ?? "C").toUpperCase();
  if (upper === "A") return "A";
  if (upper === "B") return "B";
  return "C";
}

function mapCrm(status: string): "SYNCED" | "PENDING" | "FAILED" {
  if (status === "SYNCED") return "SYNCED";
  if (status === "FAILED") return "FAILED";
  return "PENDING";
}

export async function resolveMobileExhibitorBoothAccess(
  request: Request,
  boothId: string,
): Promise<{ userId: string; orgId: string; boothId: string; eventId: string }> {
  const userId = await resolveMobileUserId(request);

  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      eventId: true,
      companyOrgId: true,
      event: { select: { orgId: true } },
    },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      orgId: true,
      userType: true,
      org: { select: { id: true } },
      ownedOrg: { select: { id: true } },
    },
  });

  const userOrgId = user?.orgId ?? user?.ownedOrg?.id ?? user?.org?.id;
  const isBoothOrg = !!userOrgId && userOrgId === booth.companyOrgId;
  const isEventOrganizer =
    user?.userType === "ACCOUNT_ADMIN" &&
    !!userOrgId &&
    userOrgId === booth.event.orgId;

  let isOperatorOrStaff = false;
  if (!isBoothOrg && !isEventOrganizer) {
    const linked = await prisma.exhibitorBooth.findFirst({
      where: {
        id: boothId,
        OR: [
          { operatorUserId: userId },
          {
            companyOrg: {
              staff: {
                some: {
                  userId,
                  status: InviteStatus.ACCEPTED,
                  role: { in: [OrgStaffRole.OWNER, OrgStaffRole.ADMIN] },
                },
              },
            },
          },
        ],
      },
      select: { id: true },
    });
    isOperatorOrStaff = !!linked;
  }

  if (!isBoothOrg && !isEventOrganizer && !isOperatorOrStaff) {
    throw new ApiError("无权访问该展位", ErrorCode.FORBIDDEN, 403);
  }

  return {
    userId,
    orgId: userOrgId ?? booth.companyOrgId,
    boothId: booth.id,
    eventId: booth.eventId,
  };
}

type BoothAccessRecord = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.exhibitorBooth.findUnique<{
        include: { event: { select: { id: true; orgId: true; organizerId: true } } };
      }>
    >
  >
>;

/** 展位 API：支持 Web Session 与小程序 Bearer */
export async function requireBoothAccessForRequest(
  request: Request,
  boothId: string,
): Promise<{ session: AuthSession; booth: BoothAccessRecord }> {
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const access = await resolveMobileExhibitorBoothAccess(request, boothId);
    const booth = await prisma.exhibitorBooth.findUnique({
      where: { id: boothId },
      include: {
        event: { select: { id: true, orgId: true, organizerId: true } },
      },
    });
    if (!booth) {
      throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
    }

    const user = await prisma.user.findUnique({
      where: { id: access.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        userType: true,
        orgId: true,
      },
    });
    if (!user) {
      throw new ApiError("用户不存在", ErrorCode.NOT_FOUND, 404);
    }

    const session = {
      user: {
        id: user.id,
        name: user.name ?? "",
        email: user.email ?? "",
        role: user.role ?? UserRole.EXHIBITOR,
        userType: user.userType,
        activeOrgId: access.orgId ?? user.orgId ?? undefined,
      },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    } as Session;

    return { session, booth };
  }

  const { session, booth } = await requireBoothAccess(boothId);
  return { session, booth: booth as BoothAccessRecord };
}

export async function buildMobileBoothDashboard(
  boothId: string,
  eventId: string,
): Promise<MobileBoothDashboard> {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: { code: true },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const [stats, leads] = await Promise.all([
    getExhibitorDashboardStats(boothId, eventId),
    listExhibitorLeads(boothId, eventId, 20),
  ]);

  let aLeads = 0;
  let bLeads = 0;
  let cLeads = 0;
  let crmSyncedCount = 0;

  for (const lead of leads) {
    const level = mapIntentLevel(lead.ai_intent_level ?? lead.intent_grade);
    if (level === "A") aLeads += 1;
    else if (level === "B") bLeads += 1;
    else cLeads += 1;
    if (lead.crm_sync_status === "SYNCED") crmSyncedCount += 1;
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const todayLeads = await prisma.lead.findMany({
    where: { boothId, createdAt: { gte: todayStart } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      participant: {
        select: { name: true, company: true, jobTitle: true, email: true, phone: true },
      },
    },
  });

  const recentLeads = await Promise.all(
    todayLeads.map(async (lead) => {
      const aiLevel = await computeLeadAiIntentLevel(
        boothId,
        eventId,
        lead.participant,
        lead.intentGrade,
      );
      return {
        id: lead.id,
        visitor_user_id: lead.participantId,
        name: lead.participant.name,
        company: lead.participant.company ?? undefined,
        title: lead.participant.jobTitle ?? undefined,
        visited_at: lead.createdAt.toISOString(),
        intent_level: mapIntentLevel(aiLevel ?? lead.intentGrade),
        crm_status: mapCrm(lead.crmSyncStatus),
      };
    }),
  );

  return {
    booth_id: boothId,
    booth_code: booth.code,
    todayVisitors: stats.today_visitors,
    aLeads,
    bLeads,
    cLeads,
    crmSyncedCount,
    recentLeads,
  };
}

export async function getMobileBoothConfig(boothId: string) {
  const booth = await prisma.exhibitorBooth.findUnique({
    where: { id: boothId },
    select: {
      id: true,
      code: true,
      eventId: true,
      leadFormConfig: true,
    },
  });
  if (!booth) {
    throw new ApiError("展位不存在", ErrorCode.NOT_FOUND, 404);
  }

  const leadForm = Array.isArray(booth.leadFormConfig) ? booth.leadFormConfig : [];

  return {
    id: booth.id,
    booth_code: booth.code,
    event_id: booth.eventId,
    lead_form_config: leadForm,
  };
}

export async function buildLegacyExhibitorDashboard(orgId: string) {
  const boothCtx = await resolveExhibitorBooth(orgId);
  if (!boothCtx) {
    throw new ApiError("未找到关联展位", ErrorCode.NOT_FOUND, 404);
  }

  const dashboard = await buildMobileBoothDashboard(boothCtx.id, boothCtx.eventId);
  const stats = await getExhibitorDashboardStats(boothCtx.id, boothCtx.eventId);
  const qrDataUrl = await QRCode.toDataURL(boothCtx.scanUrl, {
    width: 200,
    margin: 2,
    errorCorrectionLevel: "H",
  });

  return {
    booth: {
      id: boothCtx.id,
      code: boothCtx.code,
      name: boothCtx.name,
      org_name: boothCtx.orgName,
      event_id: boothCtx.eventId,
      event_name: boothCtx.eventName,
      scan_url: boothCtx.scanUrl,
      qr_data_url: qrDataUrl,
    },
    ...dashboard,
    ...stats,
  };
}
