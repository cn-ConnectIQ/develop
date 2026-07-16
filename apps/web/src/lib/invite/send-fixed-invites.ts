import {
  InviteChannel,
  ParticipantInviteStatus,
  SystemRole,
  prisma,
} from "@connectiq/database";
import { isEventFeatureEnabled } from "@/lib/event-feature-flags-server";
import {
  getInviteAutoConfig,
  resolveInviteChannelForParticipant,
} from "@/lib/invite/invite-auto-config";
import {
  FIXED_PARTICIPANT_INVITE_SUBJECT,
  FIXED_PARTICIPANT_INVITE_TEMPLATE,
} from "@/lib/invite/message";
import { triggerInviteProcessing } from "@/lib/invite/queue";
import { prepareCampaignSend } from "@/lib/invite/service";

export type SendParticipantInvitesInput = {
  eventId: string;
  participantIds: string[];
  channel: InviteChannel;
  createdBy?: string | null;
  /** 活动名用于 campaign 标题 */
  campaignName?: string;
  /**
   * true：允许对未激活者重新发送（排除 ACTIVATED）；
   * false（默认）：仅 NOT_INVITED。
   */
  allowResend?: boolean;
};

/**
 * 对指定参会者发送固定模板邀请（忽略任何自定义文案）。
 * 默认仅处理 NOT_INVITED 且具备对应联系方式的人。
 */
export async function sendFixedParticipantInvites(
  input: SendParticipantInvitesInput,
): Promise<{
  campaignId: string | null;
  queued: number;
  skipped: number;
}> {
  const uniqueIds = [...new Set(input.participantIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return { campaignId: null, queued: 0, skipped: 0 };
  }

  const participants = await prisma.participant.findMany({
    where: {
      eventId: input.eventId,
      id: { in: uniqueIds },
      inviteStatus: input.allowResend
        ? { not: ParticipantInviteStatus.ACTIVATED }
        : ParticipantInviteStatus.NOT_INVITED,
    },
    select: { id: true, phone: true, email: true },
  });

  const eligible = participants.filter((p) => {
    if (input.channel === InviteChannel.SMS) return Boolean(p.phone?.trim());
    if (input.channel === InviteChannel.EMAIL) return Boolean(p.email?.trim());
    if (input.channel === InviteChannel.WECHAT) return Boolean(p.phone?.trim());
    return false;
  });

  const skipped = uniqueIds.length - eligible.length;
  if (eligible.length === 0) {
    return { campaignId: null, queued: 0, skipped };
  }

  const campaign = await prisma.inviteCampaign.create({
    data: {
      eventId: input.eventId,
      createdBy: input.createdBy ?? null,
      name:
        input.campaignName ??
        `参会邀请 ${new Date().toLocaleString("zh-CN")}`,
      channel: input.channel,
      customMessage: FIXED_PARTICIPANT_INVITE_TEMPLATE,
      subject: FIXED_PARTICIPANT_INVITE_SUBJECT,
      targetFilter: { participant_ids: eligible.map((p) => p.id) },
      totalTarget: eligible.length,
    },
  });

  const result = await prepareCampaignSend(campaign.id);
  if (!result.isScheduled && result.queued > 0) {
    await triggerInviteProcessing(campaign.id);
  }

  return {
    campaignId: campaign.id,
    queued: result.queued,
    skipped: skipped + Math.max(0, eligible.length - result.queued),
  };
}

async function queueFixedInvitesByConfig(options: {
  eventId: string;
  participantIds: string[];
  createdBy?: string | null;
  channelPref: "SMS" | "EMAIL" | "AUTO";
  campaignPrefix: string;
}): Promise<{ triggered: boolean; queued: number }> {
  const participants = await prisma.participant.findMany({
    where: {
      eventId: options.eventId,
      id: { in: options.participantIds },
      inviteStatus: ParticipantInviteStatus.NOT_INVITED,
    },
    select: { id: true, phone: true, email: true },
  });

  const smsIds: string[] = [];
  const emailIds: string[] = [];
  for (const p of participants) {
    const channel = resolveInviteChannelForParticipant(options.channelPref, p);
    if (channel === InviteChannel.SMS) smsIds.push(p.id);
    else if (channel === InviteChannel.EMAIL) emailIds.push(p.id);
  }

  let queued = 0;
  if (smsIds.length > 0) {
    const r = await sendFixedParticipantInvites({
      eventId: options.eventId,
      participantIds: smsIds,
      channel: InviteChannel.SMS,
      createdBy: options.createdBy,
      campaignName: `${options.campaignPrefix}·短信 ${new Date().toLocaleString("zh-CN")}`,
    });
    queued += r.queued;
  }
  if (emailIds.length > 0) {
    const r = await sendFixedParticipantInvites({
      eventId: options.eventId,
      participantIds: emailIds,
      channel: InviteChannel.EMAIL,
      createdBy: options.createdBy,
      campaignName: `${options.campaignPrefix}·邮件 ${new Date().toLocaleString("zh-CN")}`,
    });
    queued += r.queued;
  }

  return { triggered: queued > 0, queued };
}

/**
 * 新参会者自动邀请：需开启 inviteSystem + 活动配置 enabled。
 * fire-and-forget 友好；调用方勿 await 失败影响主流程时可 void。
 */
export async function maybeAutoInviteNewParticipants(options: {
  eventId: string;
  participantIds: string[];
  createdBy?: string | null;
}): Promise<{ triggered: boolean; queued: number; reason?: string }> {
  const ids = [...new Set(options.participantIds.filter(Boolean))];
  if (ids.length === 0) {
    return { triggered: false, queued: 0, reason: "empty" };
  }

  if (!(await isEventFeatureEnabled(options.eventId, "inviteSystem"))) {
    return { triggered: false, queued: 0, reason: "inviteSystem_off" };
  }

  const config = await getInviteAutoConfig(options.eventId);
  if (!config.enabled) {
    return { triggered: false, queued: 0, reason: "auto_off" };
  }

  const result = await queueFixedInvitesByConfig({
    eventId: options.eventId,
    participantIds: ids,
    createdBy: options.createdBy,
    channelPref: config.channel,
    campaignPrefix: "自动邀请",
  });
  return { ...result, reason: result.triggered ? undefined : "no_eligible" };
}

/**
 * 新展商工作人员自动邀请（工作人员已是大会 Participant）。
 * 需 inviteSystem + autoOnBoothStaff。
 */
export async function maybeAutoInviteBoothStaff(options: {
  eventId: string;
  participantIds: string[];
  createdBy?: string | null;
}): Promise<{ triggered: boolean; queued: number; reason?: string }> {
  const ids = [...new Set(options.participantIds.filter(Boolean))];
  if (ids.length === 0) {
    return { triggered: false, queued: 0, reason: "empty" };
  }

  if (!(await isEventFeatureEnabled(options.eventId, "inviteSystem"))) {
    return { triggered: false, queued: 0, reason: "inviteSystem_off" };
  }

  const config = await getInviteAutoConfig(options.eventId);
  if (!config.autoOnBoothStaff) {
    return { triggered: false, queued: 0, reason: "booth_staff_auto_off" };
  }

  const result = await queueFixedInvitesByConfig({
    eventId: options.eventId,
    participantIds: ids,
    createdBy: options.createdBy,
    channelPref: config.channel,
    campaignPrefix: "展商工作人员自动邀请",
  });
  return { ...result, reason: result.triggered ? undefined : "no_eligible" };
}

/**
 * 主办方一键邀请本场全部展商工作人员（systemRole=EXHIBITOR）。
 */
export async function inviteAllExhibitors(options: {
  eventId: string;
  channel: "SMS" | "EMAIL" | "AUTO";
  createdBy?: string | null;
  /** 是否包含已邀请未激活者（默认仅 NOT_INVITED） */
  resend?: boolean;
}): Promise<{
  totalExhibitors: number;
  queued: number;
  skipped: number;
  campaignIds: string[];
}> {
  const whereBase = {
    eventId: options.eventId,
    systemRole: SystemRole.EXHIBITOR,
    ...(options.resend
      ? { inviteStatus: { not: ParticipantInviteStatus.ACTIVATED } }
      : { inviteStatus: ParticipantInviteStatus.NOT_INVITED }),
  };

  const exhibitors = await prisma.participant.findMany({
    where: whereBase,
    select: { id: true, phone: true, email: true },
  });

  const smsIds: string[] = [];
  const emailIds: string[] = [];
  for (const p of exhibitors) {
    const channel = resolveInviteChannelForParticipant(options.channel, p);
    if (channel === InviteChannel.SMS) smsIds.push(p.id);
    else if (channel === InviteChannel.EMAIL) emailIds.push(p.id);
  }

  const campaignIds: string[] = [];
  let queued = 0;
  let skipped = exhibitors.length - smsIds.length - emailIds.length;

  if (smsIds.length > 0) {
    const r = await sendFixedParticipantInvites({
      eventId: options.eventId,
      participantIds: smsIds,
      channel: InviteChannel.SMS,
      createdBy: options.createdBy,
      allowResend: Boolean(options.resend),
      campaignName: `一键邀请展商·短信 ${new Date().toLocaleString("zh-CN")}`,
    });
    queued += r.queued;
    skipped += r.skipped;
    if (r.campaignId) campaignIds.push(r.campaignId);
  }
  if (emailIds.length > 0) {
    const r = await sendFixedParticipantInvites({
      eventId: options.eventId,
      participantIds: emailIds,
      channel: InviteChannel.EMAIL,
      createdBy: options.createdBy,
      allowResend: Boolean(options.resend),
      campaignName: `一键邀请展商·邮件 ${new Date().toLocaleString("zh-CN")}`,
    });
    queued += r.queued;
    skipped += r.skipped;
    if (r.campaignId) campaignIds.push(r.campaignId);
  }

  return {
    totalExhibitors: exhibitors.length,
    queued,
    skipped,
    campaignIds,
  };
}
