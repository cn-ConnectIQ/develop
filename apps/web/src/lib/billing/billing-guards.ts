import {
  BillingOrderStatus,
  BillingPlanKind,
  prisma,
} from "@connectiq/database";
import {
  debitOrgWallet,
  getOrCreateOrgWallet,
} from "@/lib/billing/wallet-service";
import { BillingLedgerResource } from "@connectiq/database";

/** 试用组织不强制办会套餐；正式账号发布前须已为该场支付 EVENT_USAGE 套餐 */
export async function assertEventPackagePaidForPublish(
  orgId: string,
  eventId: string,
) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { adminStatus: true },
  });
  if (!org) throw new Error("组织不存在");
  if (org.adminStatus === "TRIAL") return;

  const linked = await prisma.billingOrder.findFirst({
    where: {
      orgId,
      eventId,
      status: BillingOrderStatus.PAID,
      plan: { kind: BillingPlanKind.EVENT_USAGE },
    },
    select: { id: true },
  });
  if (linked) return;

  const unbound = await prisma.billingOrder.findFirst({
    where: {
      orgId,
      eventId: null,
      status: BillingOrderStatus.PAID,
      plan: { kind: BillingPlanKind.EVENT_USAGE },
    },
    orderBy: { paidAt: "asc" },
    select: { id: true },
  });
  if (unbound) {
    await prisma.billingOrder.update({
      where: { id: unbound.id },
      data: { eventId },
    });
    return;
  }

  throw new Error(
    "发布前请先购买办会套餐（计费中心）。可前往「计费与充值」为该场完成支付。",
  );
}

export async function getOrgIdForEvent(eventId: string): Promise<string | null> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { orgId: true },
  });
  return event?.orgId ?? null;
}

/** 正式组织创建互动会话扣 1 互动点；试用跳过。overdraft_limit 默认 0（耗尽即停） */
export async function assertAndDebitInteractionPoint(input: {
  orgId: string;
  eventId: string;
  createdByUserId?: string;
}) {
  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { adminStatus: true, overdraftLimit: true },
  });
  if (!org || org.adminStatus === "TRIAL") return;

  const wallet = await getOrCreateOrgWallet(input.orgId);
  const overdraft = org.overdraftLimit ?? 0;
  if (wallet.interactionPointsBalance + overdraft < 1) {
    throw new Error(
      "互动点不足，请先在「计费与充值」购买办会套餐或互动点后再发起互动。",
    );
  }

  try {
    await debitOrgWallet({
      orgId: input.orgId,
      resource: BillingLedgerResource.INTERACTION_POINT,
      amount: 1,
      eventId: input.eventId,
      createdByUserId: input.createdByUserId,
      remark: "创建现场互动会话",
    });
  } catch {
    // 透支额度 >0 时允许余额为 0 仍扣减（通过临时加点再扣——简化：若透支配置>0且余额为0则 credit 1 再 debit）
    if (overdraft > 0 && wallet.interactionPointsBalance <= 0) {
      const { creditOrgWallet } = await import("@/lib/billing/wallet-service");
      await creditOrgWallet({
        orgId: input.orgId,
        resource: BillingLedgerResource.INTERACTION_POINT,
        amount: 1,
        eventId: input.eventId,
        remark: "透支额度临时入账",
      });
      await debitOrgWallet({
        orgId: input.orgId,
        resource: BillingLedgerResource.INTERACTION_POINT,
        amount: 1,
        eventId: input.eventId,
        createdByUserId: input.createdByUserId,
        remark: "创建现场互动会话(透支)",
      });
      return;
    }
    throw new Error(
      "互动点不足，请先在「计费与充值」购买办会套餐或互动点后再发起互动。",
    );
  }
}

export async function assertInviteChannelBalance(input: {
  orgId: string;
  channel: "SMS" | "EMAIL" | "WECHAT";
  count: number;
}) {
  if (input.channel === "WECHAT" || input.count <= 0) return;

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { adminStatus: true },
  });
  if (!org || org.adminStatus === "TRIAL") return;

  const wallet = await getOrCreateOrgWallet(input.orgId);
  if (input.channel === "SMS" && wallet.smsBalance < input.count) {
    throw new Error(
      `短信额度不足：需要 ${input.count} 条，当前余额 ${wallet.smsBalance}。请先充值。`,
    );
  }
  if (input.channel === "EMAIL" && wallet.emailBalance < input.count) {
    throw new Error(
      `邮件额度不足：需要 ${input.count} 封，当前余额 ${wallet.emailBalance}。请先充值。`,
    );
  }
}

/** 发送成功后扣 1 条短信/邮件额度；不足则返回 false（由调用方标失败） */
export async function tryDebitInviteCredit(input: {
  orgId: string;
  channel: "SMS" | "EMAIL" | "WECHAT";
  eventId?: string;
  orderId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  if (input.channel === "WECHAT") return { ok: true };

  const org = await prisma.organization.findUnique({
    where: { id: input.orgId },
    select: { adminStatus: true },
  });
  if (!org || org.adminStatus === "TRIAL") return { ok: true };

  const resource =
    input.channel === "SMS"
      ? BillingLedgerResource.SMS
      : BillingLedgerResource.EMAIL;

  try {
    await debitOrgWallet({
      orgId: input.orgId,
      resource,
      amount: 1,
      eventId: input.eventId,
      remark: `邀请${input.channel === "SMS" ? "短信" : "邮件"}发送`,
    });
    return { ok: true };
  } catch {
    return {
      ok: false,
      error:
        input.channel === "SMS"
          ? "短信额度不足，发送已中止"
          : "邮件额度不足，发送已中止",
    };
  }
}
