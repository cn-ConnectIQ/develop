import { prisma } from "@connectiq/database";
import { NOTIFICATION_TEMPLATE_SEEDS } from "@/lib/notification/templates";

export async function seedNotificationTemplates() {
  for (const t of NOTIFICATION_TEMPLATE_SEEDS) {
    await prisma.notificationTemplate.upsert({
      where: { code: t.code },
      create: {
        code: t.code,
        name: t.name,
        channel: t.channel,
        category: t.category,
        audience: t.audience,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        requiresOptOut: t.requiresOptOut,
        enabled: true,
      },
      update: {
        name: t.name,
        channel: t.channel,
        category: t.category,
        audience: t.audience,
        subject: t.subject,
        body: t.body,
        variables: t.variables,
        requiresOptOut: t.requiresOptOut,
        enabled: true,
      },
    });
  }
  return NOTIFICATION_TEMPLATE_SEEDS.length;
}
