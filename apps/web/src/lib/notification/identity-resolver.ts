import { prisma } from "@connectiq/database";

export type ResolvedIdentity = {
  phone: string | null;
  email: string | null;
  name: string;
};

/** user_id 为主键；phone/email 优先 UserIdentity，回退 User 字段 */
export async function resolveUserIdentity(
  userId: string,
): Promise<ResolvedIdentity | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      phone: true,
      email: true,
      identities: { select: { provider: true, value: true, verified: true } },
    },
  });
  if (!user) return null;

  let phone = user.phone?.trim() || null;
  let email = user.email?.trim() || null;

  for (const id of user.identities) {
    if (id.provider === "phone" && id.value?.trim()) {
      phone = id.value.trim();
    }
    if (id.provider === "email" && id.value?.trim()) {
      email = id.value.trim();
    }
  }

  return { phone, email, name: user.name };
}

export async function ensureUserIdentitiesFromUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true, email: true },
  });
  if (!user) return;

  if (user.email) {
    await prisma.userIdentity.upsert({
      where: { userId_provider: { userId, provider: "email" } },
      create: { userId, provider: "email", value: user.email, verified: true },
      update: { value: user.email },
    });
  }
  if (user.phone) {
    await prisma.userIdentity.upsert({
      where: { userId_provider: { userId, provider: "phone" } },
      create: { userId, provider: "phone", value: user.phone, verified: false },
      update: { value: user.phone },
    });
  }
}
