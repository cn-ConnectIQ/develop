import { prisma } from "@connectiq/database";

export type ApiContactCard = {
  wechat_qr_url: string | null;
  wechat_id: string | null;
  show_phone: boolean;
  show_email: boolean;
  email: string | null;
  allow_exchange: boolean;
  auto_accept_at_event: boolean;
  headline: string | null;
  card_theme: string;
};

export type UpdateContactCardInput = Partial<{
  wechatQrUrl: string | null;
  wechatId: string | null;
  showPhone: boolean;
  showEmail: boolean;
  email: string | null;
  allowExchange: boolean;
  autoAcceptAtEvent: boolean;
  headline: string | null;
  cardTheme: string;
}>;

function serialize(card: {
  wechatQrUrl: string | null;
  wechatId: string | null;
  showPhone: boolean;
  showEmail: boolean;
  email: string | null;
  allowExchange: boolean;
  autoAcceptAtEvent: boolean;
  headline: string | null;
  cardTheme: string;
}): ApiContactCard {
  return {
    wechat_qr_url: card.wechatQrUrl,
    wechat_id: card.wechatId,
    show_phone: card.showPhone,
    show_email: card.showEmail,
    email: card.email,
    allow_exchange: card.allowExchange,
    auto_accept_at_event: card.autoAcceptAtEvent,
    headline: card.headline,
    card_theme: card.cardTheme,
  };
}

export async function getOrCreateContactCard(
  userId: string,
): Promise<ApiContactCard> {
  const existing = await prisma.contactCard.findUnique({
    where: { userId },
  });
  if (existing) return serialize(existing);

  const created = await prisma.contactCard.create({
    data: { userId },
  });
  return serialize(created);
}

export async function updateContactCard(
  userId: string,
  input: UpdateContactCardInput,
): Promise<ApiContactCard> {
  await getOrCreateContactCard(userId);

  const updated = await prisma.contactCard.update({
    where: { userId },
    data: {
      ...(input.wechatQrUrl !== undefined ? { wechatQrUrl: input.wechatQrUrl } : {}),
      ...(input.wechatId !== undefined ? { wechatId: input.wechatId } : {}),
      ...(input.showPhone !== undefined ? { showPhone: input.showPhone } : {}),
      ...(input.showEmail !== undefined ? { showEmail: input.showEmail } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.allowExchange !== undefined
        ? { allowExchange: input.allowExchange }
        : {}),
      ...(input.autoAcceptAtEvent !== undefined
        ? { autoAcceptAtEvent: input.autoAcceptAtEvent }
        : {}),
      ...(input.headline !== undefined ? { headline: input.headline } : {}),
      ...(input.cardTheme !== undefined ? { cardTheme: input.cardTheme } : {}),
    },
  });

  return serialize(updated);
}
