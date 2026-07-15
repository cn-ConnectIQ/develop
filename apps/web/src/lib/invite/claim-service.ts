import {
  InviteRecordStatus,
  ParticipantInviteStatus,
  prisma,
} from "@connectiq/database";
import { ErrorCode } from "@connectiq/types";
import { ApiError } from "@/lib/api-auth";
import { buildHonorific } from "@/lib/notification/render";
import { phonesMatchHash } from "@/lib/invite/token";
import {
  buildMiniLoginResult,
  exchangePhoneCodeForInvite,
  exchangeWxCodeForInvite,
  bindMiniOpenId,
  findMiniUserByOpenId,
  findOrCreateMiniUserByPhone,
  linkMiniUserToEvent,
  silentActivateInvite,
} from "@/lib/invite/mini-bridge";
import { recordInviteClick } from "@/lib/invite/service";

export type InviteResolveResult =
  | { kind: "invalid" | "expired" }
  | {
      kind: "ok";
      token: string;
      event: {
        id: string;
        name: string;
        short_name: string | null;
        location: string | null;
        start_date: string | null;
        end_date: string | null;
        status: string;
      };
      invitee: {
        user_id: string | null;
        name: string;
        honorific: string;
        company: string | null;
      };
      is_activated: boolean;
      is_returning: boolean;
      identity_match: boolean | null;
      session_user_id: string | null;
      needs_intent: boolean;
      mp_url_link: string | null;
      mini_path: string;
      app_join_fallback: string;
    };

async function loadInviteRecord(token: string) {
  return prisma.inviteRecord.findUnique({
    where: { activationToken: token },
    include: {
      participant: true,
      campaign: {
        include: {
          event: {
            select: {
              id: true,
              name: true,
              shortName: true,
              location: true,
              startDate: true,
              endDate: true,
              status: true,
            },
          },
        },
      },
      user: { select: { id: true, name: true } },
    },
  });
}

export async function resolveInviteToken(input: {
  token: string;
  wxCode?: string | null;
  sessionUserId?: string | null;
}): Promise<InviteResolveResult> {
  const token = input.token.trim();
  if (!token) return { kind: "invalid" };

  const record = await loadInviteRecord(token);
  if (!record) return { kind: "invalid" };
  if (record.tokenExpiresAt.getTime() < Date.now()) return { kind: "expired" };

  await recordInviteClick(token);

  const event = record.campaign.event;
  const name = record.participant.name;
  const inviteUserId = record.userId;

  let sessionUserId = input.sessionUserId ?? null;
  let isReturning = false;
  let identityMatch: boolean | null = null;

  if (input.wxCode) {
    try {
      const { openid } = await exchangeWxCodeForInvite(input.wxCode);
      const wxUser = await findMiniUserByOpenId(openid);
      if (wxUser) {
        isReturning = true;
        sessionUserId = wxUser.id;
        identityMatch = inviteUserId ? wxUser.id === inviteUserId : null;
      } else {
        isReturning = false;
        identityMatch = null;
      }
    } catch {
      /* wx code 可选 */
    }
  } else if (sessionUserId) {
    isReturning = true;
    identityMatch = inviteUserId ? sessionUserId === inviteUserId : null;
  }

  const intent =
    sessionUserId || inviteUserId
      ? await prisma.userEventIntent.findUnique({
          where: {
            userId_eventId: {
              userId: (sessionUserId || inviteUserId)!,
              eventId: event.id,
            },
          },
          select: { userId: true },
        })
      : null;

  const isActivated =
    record.status === InviteRecordStatus.ACTIVATED ||
    record.participant.inviteStatus === ParticipantInviteStatus.ACTIVATED;

  const appBase =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://9li.co/uc";
  // URL Link 需微信开放平台配置；未配置时由 H5 用 scheme / 复制引导
  const mpUrlLink = process.env.WX_MP_URL_LINK_BASE
    ? `${process.env.WX_MP_URL_LINK_BASE}?token=${encodeURIComponent(token)}`
    : null;

  return {
    kind: "ok",
    token,
    event: {
      id: event.id,
      name: event.name,
      short_name: event.shortName,
      location: event.location,
      start_date: event.startDate?.toISOString() ?? null,
      end_date: event.endDate?.toISOString() ?? null,
      status: event.status,
    },
    invitee: {
      user_id: inviteUserId,
      name,
      honorific: buildHonorific(name),
      company: record.participant.company,
    },
    is_activated: isActivated,
    is_returning: isReturning,
    identity_match: identityMatch,
    session_user_id: sessionUserId,
    needs_intent: !intent,
    mp_url_link: mpUrlLink,
    mini_path: `/pages/activation/landing?token=${encodeURIComponent(token)}&eventId=${event.id}`,
    app_join_fallback: `${appBase}/join?token=${encodeURIComponent(token)}&event=${event.id}`,
  };
}

/** A1：openid 老用户静默认领（身份以 openid 为准，活动关联过来） */
export async function silentClaimByWxCode(input: {
  token: string;
  wxCode: string;
}) {
  const record = await loadInviteRecord(input.token);
  if (!record || record.tokenExpiresAt.getTime() < Date.now()) {
    throw new ApiError("邀请链接无效或已过期", ErrorCode.NOT_FOUND, 404);
  }

  const { openid, unionid } = await exchangeWxCodeForInvite(input.wxCode);
  const wxUser = await findMiniUserByOpenId(openid);
  if (!wxUser) {
    throw new ApiError("NOT_RETURNING", ErrorCode.VALIDATION_ERROR, 400);
  }

  await linkMiniUserToEvent(wxUser.id, record.campaign.eventId);
  await silentActivateInvite({
    recordId: record.id,
    campaignId: record.campaignId,
    participantId: record.participantId,
    actingUserId: wxUser.id,
    tokenUserId: record.userId,
  });

  const intent = await prisma.userEventIntent.findUnique({
    where: {
      userId_eventId: {
        userId: wxUser.id,
        eventId: record.campaign.eventId,
      },
    },
  });

  const login = await buildMiniLoginResult(wxUser.id);
  return {
    ...login,
    welcome_toast: `欢迎回来，${buildHonorific(wxUser.name)}`,
    event_id: record.campaign.eventId,
    needs_intent: !intent,
    path: intent
      ? "recommendations"
      : "intent",
  };
}

/**
 * A2：新用户微信手机号一键授权认领
 * phone hash 一致 → 绑定到 token.user_id（或名单身份）
 * 不一致 → 标准新参会者（拉新）
 */
export async function claimInviteWithPhone(input: {
  token: string;
  wxCode: string;
  phoneCode: string;
}) {
  const record = await loadInviteRecord(input.token);
  if (!record || record.tokenExpiresAt.getTime() < Date.now()) {
    throw new ApiError("邀请链接无效或已过期", ErrorCode.NOT_FOUND, 404);
  }

  const [{ openid, unionid }, phone] = await Promise.all([
    exchangeWxCodeForInvite(input.wxCode),
    exchangePhoneCodeForInvite(input.phoneCode),
  ]);

  const phoneMatched = phonesMatchHash(phone, record.phoneHash);
  const eventId = record.campaign.eventId;

  if (phoneMatched) {
    // 认领名单身份
    let targetUserId = record.userId;
    if (!targetUserId) {
      const byPhone = await findOrCreateMiniUserByPhone(phone, {
        name: record.participant.name,
        company: record.participant.company,
      });
      targetUserId = byPhone.id;
    } else {
      await prisma.user.update({
        where: { id: targetUserId },
        data: { phone },
      });
    }

    await bindMiniOpenId(targetUserId, openid, unionid);
    await linkMiniUserToEvent(targetUserId, eventId);
    await silentActivateInvite({
      recordId: record.id,
      campaignId: record.campaignId,
      participantId: record.participantId,
      actingUserId: targetUserId,
      tokenUserId: record.userId,
    });

    const intent = await prisma.userEventIntent.findUnique({
      where: { userId_eventId: { userId: targetUserId, eventId } },
    });
    const login = await buildMiniLoginResult(targetUserId);
    return {
      ...login,
      claim: "matched" as const,
      event_id: eventId,
      needs_intent: !intent,
      honorific: buildHonorific(record.participant.name),
    };
  }

  // 转发场景：标准新参会者
  const newUser = await findOrCreateMiniUserByPhone(phone);
  await bindMiniOpenId(newUser.id, openid, unionid);
  await linkMiniUserToEvent(newUser.id, eventId);
  const login = await buildMiniLoginResult(newUser.id);
  return {
    ...login,
    claim: "forwarded" as const,
    event_id: eventId,
    needs_intent: true,
    message: `看起来你不是${buildHonorific(record.participant.name)}本人？没关系，你也可以作为参会者加入「${record.campaign.event.name}」。`,
  };
}

/** 渐进式授权：拒绝手机号，以 openid 访客进入，不绑定名单身份 */
export async function enterAsUnverifiedGuest(input: {
  token: string;
  wxCode: string;
}) {
  const record = await loadInviteRecord(input.token);
  if (!record || record.tokenExpiresAt.getTime() < Date.now()) {
    throw new ApiError("邀请链接无效或已过期", ErrorCode.NOT_FOUND, 404);
  }

  const { openid, unionid } = await exchangeWxCodeForInvite(input.wxCode);
  let user = await findMiniUserByOpenId(openid);
  if (!user) {
    // 创建未核验访客（临时用户），不绑定 phone / 名单 user
    const created = await findOrCreateMiniUserByPhone(
      `guest_${openid.slice(0, 12)}`,
      { name: "访客", skipPhone: true, openid, unionid },
    );
    user = created;
  }

  await linkMiniUserToEvent(user.id, record.campaign.eventId);
  const login = await buildMiniLoginResult(user.id);
  return {
    ...login,
    claim: "guest" as const,
    event_id: record.campaign.eventId,
    verified: false,
    message:
      "你可以先体验一下。发起连接或查看专属推荐时，需要授权手机号以确认受邀身份。",
  };
}
