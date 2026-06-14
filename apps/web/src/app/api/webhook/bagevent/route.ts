import { prisma, PrismaUserRole, WebhookStatus, type Prisma } from "@connectiq/database";
import { z } from "zod";
import { jsonSuccess, withAuth } from "@/lib/api-handler";

const webhookSchema = z.object({
  source: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export const POST = withAuth(
  async (_request, { body }) => {
    const log = await prisma.webhookLog.create({
      data: {
        source: body.source,
        payload: body.payload as Prisma.InputJsonValue,
        status: WebhookStatus.RECEIVED,
      },
    });

    return jsonSuccess({ id: log.id, status: log.status }, 201);
  },
  {
    roles: [PrismaUserRole.PLATFORM_ADMIN, PrismaUserRole.EXPO_ORGANIZER],
    schema: webhookSchema,
  },
);
