import {
  NotificationJobStatus,
  OutboundChannel,
  prisma,
} from "@connectiq/database";
import {
  countActivatedParticipants,
  resolveAudienceMembers,
} from "@/lib/notification/audience";
import {
  isWithinSendWindow,
} from "@/lib/notification/compliance";
import { notifyUser } from "@/lib/notification/notification-service";
import {
  assertShortNameValid,
  buildHonorific,
  calcSmsSegments,
  formatSmsFeeHint,
  renderTemplate,
} from "@/lib/notification/render";
import type { AudienceFilter, NotifyPayload } from "@/lib/notification/types";
import { ensureUserIdentitiesFromUser } from "@/lib/notification/identity-resolver";

async function assertEventOrgAccess(eventId: string, orgId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, orgId },
    select: { id: true, shortName: true, name: true, orgId: true },
  });
  if (!event) throw new Error("活动不存在或无权访问");
  return event;
}

export async function listEnabledTemplates() {
  return prisma.notificationTemplate.findMany({
    where: { enabled: true },
    orderBy: { code: "asc" },
  });
}

export async function listNotificationJobs(eventId: string) {
  return prisma.notificationJob.findMany({
    where: { eventId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      templateCode: true,
      status: true,
      totalCount: true,
      sentCount: true,
      failedCount: true,
      sampleTestedAt: true,
      complianceConfirmedAt: true,
      createdAt: true,
      scheduledAt: true,
      audienceFilter: true,
      variableOverrides: true,
      template: {
        select: { name: true, channel: true },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });
}

export async function previewAudience(input: {
  eventId: string;
  orgId: string;
  filter: AudienceFilter;
  templateCode: string;
  variableOverrides?: NotifyPayload;
}) {
  await assertEventOrgAccess(input.eventId, input.orgId);
  const template = await prisma.notificationTemplate.findUnique({
    where: { code: input.templateCode },
  });
  if (!template) throw new Error("模板不存在");

  if (
    template.channel === OutboundChannel.SMS &&
    input.filter.type === "all_attendees" &&
    !input.filter.confirm_all_attendees_sms
  ) {
    throw new Error("短信渠道选择「全部参会者」需二次确认");
  }

  const members = await resolveAudienceMembers(input.eventId, input.filter);
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: input.eventId },
    select: { name: true, shortName: true, location: true, startDate: true },
  });

  if (template.channel === OutboundChannel.SMS) {
    assertShortNameValid(event.shortName);
  }

  const overrides = Object.fromEntries(
    Object.entries(input.variableOverrides ?? {}).map(([k, v]) => [
      k,
      v == null ? "" : String(v),
    ]),
  );

  const sample = members.slice(0, 3).map((m) => {
    const honorific = buildHonorific(m.name);
    const vars: Record<string, string> = {
      姓氏称谓: honorific,
      活动全称: event.name,
      活动简称: event.shortName ?? event.name.slice(0, 8),
      开幕日期: event.startDate
        ? new Intl.DateTimeFormat("zh-CN", {
            timeZone: "Asia/Shanghai",
            month: "numeric",
            day: "numeric",
          }).format(event.startDate)
        : "",
      活动地点: event.location ?? "",
      短链: "9li.co/a/preview",
      完整链接: "https://9li.co/a/preview",
      已启用人数: String(0),
      ...overrides,
    };
    const body = renderTemplate(template.body, vars);
    const subject = template.subject
      ? renderTemplate(template.subject, vars)
      : null;
    const smsMeta =
      template.channel === OutboundChannel.SMS
        ? calcSmsSegments(body)
        : null;
    return {
      participant_id: m.participantId,
      user_id: m.userId,
      name: m.name,
      recipient_hint: template.channel === OutboundChannel.SMS ? m.phone : m.email,
      subject,
      body,
      sms: smsMeta,
      fee_hint: smsMeta ? formatSmsFeeHint(body) : null,
    };
  });

  return {
    total: members.length,
    with_user_id: members.filter((m) => m.userId).length,
    samples: sample,
  };
}

export async function createNotificationJob(input: {
  eventId: string;
  orgId: string;
  createdById: string;
  templateCode: string;
  audienceFilter: AudienceFilter;
  variableOverrides?: NotifyPayload;
  scheduledAt?: Date | null;
}) {
  await assertEventOrgAccess(input.eventId, input.orgId);
  const template = await prisma.notificationTemplate.findUnique({
    where: { code: input.templateCode },
  });
  if (!template?.enabled) throw new Error("模板不存在或未启用");

  const members = await resolveAudienceMembers(
    input.eventId,
    input.audienceFilter,
  );

  return prisma.notificationJob.create({
    data: {
      eventId: input.eventId,
      templateCode: input.templateCode,
      createdById: input.createdById,
      audienceFilter: input.audienceFilter,
      variableOverrides: input.variableOverrides ?? {},
      scheduledAt: input.scheduledAt ?? null,
      status: input.scheduledAt
        ? NotificationJobStatus.SCHEDULED
        : NotificationJobStatus.DRAFT,
      totalCount: members.filter((m) => m.userId).length,
    },
  });
}

export async function confirmJobCompliance(input: {
  jobId: string;
  eventId: string;
  orgId: string;
  userId: string;
}) {
  await assertEventOrgAccess(input.eventId, input.orgId);
  const job = await prisma.notificationJob.findFirst({
    where: { id: input.jobId, eventId: input.eventId },
  });
  if (!job) throw new Error("任务不存在");

  return prisma.notificationJob.update({
    where: { id: job.id },
    data: {
      complianceConfirmedById: input.userId,
      complianceConfirmedAt: new Date(),
    },
  });
}

export async function sendJobSampleTest(input: {
  jobId: string;
  eventId: string;
  orgId: string;
  operatorUserId: string;
}) {
  await assertEventOrgAccess(input.eventId, input.orgId);
  const job = await prisma.notificationJob.findFirst({
    where: { id: input.jobId, eventId: input.eventId },
  });
  if (!job) throw new Error("任务不存在");

  await ensureUserIdentitiesFromUser(input.operatorUserId);

  const overrides = (job.variableOverrides ?? {}) as NotifyPayload;
  const result = await notifyUser({
    userId: input.operatorUserId,
    templateCode: job.templateCode,
    eventId: input.eventId,
    jobId: job.id,
    payload: overrides,
    skipQuota: true,
    debitWallet: true,
  });

  if (!result.success) {
    throw new Error(result.error ?? "小样发送失败");
  }

  await prisma.notificationJob.update({
    where: { id: job.id },
    data: { sampleTestedAt: new Date() },
  });

  return result;
}

export async function dispatchNotificationJob(input: {
  jobId: string;
  eventId: string;
  orgId: string;
}) {
  await assertEventOrgAccess(input.eventId, input.orgId);
  const job = await prisma.notificationJob.findFirst({
    where: { id: input.jobId, eventId: input.eventId },
    include: { template: true },
  });
  if (!job) throw new Error("任务不存在");
  if (!job.complianceConfirmedAt) {
    throw new Error("请先勾选合规确认");
  }
  if (!job.sampleTestedAt) {
    throw new Error("请先完成小样测试");
  }
  if (
    job.template.category === "MARKETING" &&
    !isWithinSendWindow()
  ) {
    throw new Error("营销类通知仅可在 08:00–21:00（北京时间）发送");
  }

  await prisma.notificationJob.update({
    where: { id: job.id },
    data: { status: NotificationJobStatus.SENDING },
  });

  const filter = job.audienceFilter as AudienceFilter;
  const members = await resolveAudienceMembers(input.eventId, filter);
  const activatedCount = await countActivatedParticipants(input.eventId);
  const overrides = {
    ...((job.variableOverrides ?? {}) as NotifyPayload),
    已启用人数: activatedCount,
  };

  let sent = 0;
  let failed = 0;

  for (const m of members) {
    if (!m.userId) {
      failed += 1;
      continue;
    }
    const r = await notifyUser({
      userId: m.userId,
      templateCode: job.templateCode,
      eventId: input.eventId,
      jobId: job.id,
      payload: overrides,
      orgId: input.orgId,
    });
    if (r.success) sent += 1;
    else failed += 1;
  }

  await prisma.notificationJob.update({
    where: { id: job.id },
    data: {
      status: NotificationJobStatus.DONE,
      sentCount: sent,
      failedCount: failed,
      totalCount: members.length,
    },
  });

  return { sent, failed, total: members.length };
}

export async function getJobAnalytics(jobId: string, eventId: string) {
  const job = await prisma.notificationJob.findFirst({
    where: { id: jobId, eventId },
  });
  if (!job) throw new Error("任务不存在");

  const records = await prisma.notificationRecord.findMany({
    where: { jobId },
    select: {
      status: true,
      clickedAt: true,
      convertedAt: true,
      channel: true,
    },
  });

  const total = records.length || job.totalCount || 1;
  const delivered = records.filter(
    (r) => r.status === "DELIVERED" || r.status === "SENT",
  ).length;
  const clicked = records.filter((r) => r.clickedAt).length;
  const converted = records.filter((r) => r.convertedAt).length;
  const failed = records.filter(
    (r) => r.status === "FAILED" || r.status === "BOUNCED",
  ).length;

  const optouts = await prisma.optOutList.count({
    where: { eventId },
  });

  const smsSegments = records.filter((r) => r.channel === "SMS").length;

  return {
    // 顺序：转化 → 点击 → 送达 → 退订 → 成本
    conversion_rate: delivered ? converted / delivered : 0,
    click_rate: delivered ? clicked / delivered : 0,
    delivery_rate: total ? delivered / total : 0,
    optout_count: optouts,
    complaint_count: 0,
    cost: {
      sms_count: smsSegments,
      email_count: records.filter((r) => r.channel === "EMAIL").length,
      unit_price_sms: Number(process.env.SMS_UNIT_PRICE ?? 0.05),
      unit_price_email: Number(process.env.EMAIL_UNIT_PRICE ?? 0.01),
    },
    raw: {
      total,
      delivered,
      clicked,
      converted,
      failed,
      sent: job.sentCount,
    },
  };
}
