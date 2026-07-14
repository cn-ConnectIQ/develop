import {
  BillingLedgerResource,
  BillingLedgerType,
  BillingOrderStatus,
  BillingPaymentChannel,
  prisma,
  type Prisma,
} from "@connectiq/database";

export type WalletBalances = {
  smsBalance: number;
  emailBalance: number;
  interactionPointsBalance: number;
};

/** 确保组织有钱包；首次访问时创建 */
export async function getOrCreateOrgWallet(orgId: string) {
  const existing = await prisma.orgWallet.findUnique({ where: { orgId } });
  if (existing) return existing;
  return prisma.orgWallet.create({
    data: { orgId },
  });
}

export async function getOrgWalletBalances(orgId: string): Promise<WalletBalances> {
  const wallet = await getOrCreateOrgWallet(orgId);
  return {
    smsBalance: wallet.smsBalance,
    emailBalance: wallet.emailBalance,
    interactionPointsBalance: wallet.interactionPointsBalance,
  };
}

type CreditInput = {
  orgId: string;
  resource: BillingLedgerResource;
  amount: number;
  remark?: string;
  orderId?: string;
  eventId?: string;
  createdByUserId?: string;
  type?: BillingLedgerType;
};

/**
 * 钱包入账（充值 / 开通套餐赠送）。
 * amount 必须为正整数。
 */
export async function creditOrgWallet(input: CreditInput) {
  if (input.amount <= 0) {
    throw new Error("credit amount must be positive");
  }

  return prisma.$transaction(async (tx) => {
    const wallet =
      (await tx.orgWallet.findUnique({ where: { orgId: input.orgId } })) ??
      (await tx.orgWallet.create({ data: { orgId: input.orgId } }));

    const data = balancePatch(input.resource, input.amount);
    const updated = await tx.orgWallet.update({
      where: { id: wallet.id },
      data,
    });

    const balanceAfter = pickBalance(updated, input.resource);
    await tx.billingLedger.create({
      data: {
        orgId: input.orgId,
        walletId: wallet.id,
        orderId: input.orderId,
        eventId: input.eventId,
        type: input.type ?? BillingLedgerType.CREDIT,
        resource: input.resource,
        amount: input.amount,
        balanceAfter,
        remark: input.remark,
        createdByUserId: input.createdByUserId,
      },
    });

    return updated;
  });
}

/**
 * 钱包扣减。余额不足时抛错。
 * amount 必须为正整数（扣减量）。
 */
export async function debitOrgWallet(input: CreditInput) {
  if (input.amount <= 0) {
    throw new Error("debit amount must be positive");
  }

  return prisma.$transaction(async (tx) => {
    const wallet =
      (await tx.orgWallet.findUnique({ where: { orgId: input.orgId } })) ??
      (await tx.orgWallet.create({ data: { orgId: input.orgId } }));

    const current = pickBalance(wallet, input.resource);
    if (current < input.amount) {
      throw new Error(
        `insufficient ${input.resource} balance: have ${current}, need ${input.amount}`,
      );
    }

    const data = balancePatch(input.resource, -input.amount);
    const updated = await tx.orgWallet.update({
      where: { id: wallet.id },
      data,
    });

    const balanceAfter = pickBalance(updated, input.resource);
    await tx.billingLedger.create({
      data: {
        orgId: input.orgId,
        walletId: wallet.id,
        orderId: input.orderId,
        eventId: input.eventId,
        type: input.type ?? BillingLedgerType.DEBIT,
        resource: input.resource,
        amount: input.amount,
        balanceAfter,
        remark: input.remark,
        createdByUserId: input.createdByUserId,
      },
    });

    return updated;
  });
}

/** 订单标为已支付，并按套餐入账（幂等：已 PAID 则跳过入账） */
export async function markOrderPaidAndFulfill(orderId: string, paidByUserId?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.billingOrder.findUnique({
      where: { id: orderId },
      include: { plan: true },
    });
    if (!order) throw new Error("order not found");
    if (order.status === BillingOrderStatus.PAID) {
      return { order, fulfilled: false as const };
    }
    if (order.status !== BillingOrderStatus.PENDING) {
      throw new Error(`cannot pay order in status ${order.status}`);
    }

    const paid = await tx.billingOrder.update({
      where: { id: orderId },
      data: {
        status: BillingOrderStatus.PAID,
        paidAt: new Date(),
        paymentChannel: order.paymentChannel ?? BillingPaymentChannel.MANUAL,
      },
      include: { plan: true },
    });

    if (paid.plan) {
      await fulfillPlanCredits(tx, {
        orgId: paid.orgId,
        orderId: paid.id,
        eventId: paid.eventId,
        createdByUserId: paidByUserId ?? paid.createdByUserId ?? undefined,
        sms: paid.plan.includesSms,
        email: paid.plan.includesEmail,
        interactionPoints: paid.plan.includesInteractionPoints,
        remark: `订单入账：${paid.title}`,
      });
    }

    return { order: paid, fulfilled: true as const };
  });
}

async function fulfillPlanCredits(
  tx: Prisma.TransactionClient,
  input: {
    orgId: string;
    orderId: string;
    eventId?: string | null;
    createdByUserId?: string;
    sms: number;
    email: number;
    interactionPoints: number;
    remark: string;
  },
) {
  const wallet =
    (await tx.orgWallet.findUnique({ where: { orgId: input.orgId } })) ??
    (await tx.orgWallet.create({ data: { orgId: input.orgId } }));

  const patches: Prisma.OrgWalletUpdateInput = {};
  if (input.sms > 0) patches.smsBalance = { increment: input.sms };
  if (input.email > 0) patches.emailBalance = { increment: input.email };
  if (input.interactionPoints > 0) {
    patches.interactionPointsBalance = { increment: input.interactionPoints };
  }

  if (Object.keys(patches).length === 0) return;

  const updated = await tx.orgWallet.update({
    where: { id: wallet.id },
    data: patches,
  });

  const entries: Prisma.BillingLedgerCreateManyInput[] = [];
  if (input.sms > 0) {
    entries.push({
      orgId: input.orgId,
      walletId: wallet.id,
      orderId: input.orderId,
      eventId: input.eventId ?? undefined,
      type: BillingLedgerType.CREDIT,
      resource: BillingLedgerResource.SMS,
      amount: input.sms,
      balanceAfter: updated.smsBalance,
      remark: input.remark,
      createdByUserId: input.createdByUserId,
    });
  }
  if (input.email > 0) {
    entries.push({
      orgId: input.orgId,
      walletId: wallet.id,
      orderId: input.orderId,
      eventId: input.eventId ?? undefined,
      type: BillingLedgerType.CREDIT,
      resource: BillingLedgerResource.EMAIL,
      amount: input.email,
      balanceAfter: updated.emailBalance,
      remark: input.remark,
      createdByUserId: input.createdByUserId,
    });
  }
  if (input.interactionPoints > 0) {
    entries.push({
      orgId: input.orgId,
      walletId: wallet.id,
      orderId: input.orderId,
      eventId: input.eventId ?? undefined,
      type: BillingLedgerType.CREDIT,
      resource: BillingLedgerResource.INTERACTION_POINT,
      amount: input.interactionPoints,
      balanceAfter: updated.interactionPointsBalance,
      remark: input.remark,
      createdByUserId: input.createdByUserId,
    });
  }

  if (entries.length) {
    await tx.billingLedger.createMany({ data: entries });
  }
}

function balancePatch(
  resource: BillingLedgerResource,
  delta: number,
): Prisma.OrgWalletUpdateInput {
  switch (resource) {
    case BillingLedgerResource.SMS:
      return { smsBalance: { increment: delta } };
    case BillingLedgerResource.EMAIL:
      return { emailBalance: { increment: delta } };
    case BillingLedgerResource.INTERACTION_POINT:
      return { interactionPointsBalance: { increment: delta } };
    default:
      throw new Error(`unknown resource ${resource}`);
  }
}

function pickBalance(
  wallet: {
    smsBalance: number;
    emailBalance: number;
    interactionPointsBalance: number;
  },
  resource: BillingLedgerResource,
) {
  switch (resource) {
    case BillingLedgerResource.SMS:
      return wallet.smsBalance;
    case BillingLedgerResource.EMAIL:
      return wallet.emailBalance;
    case BillingLedgerResource.INTERACTION_POINT:
      return wallet.interactionPointsBalance;
    default:
      return 0;
  }
}
