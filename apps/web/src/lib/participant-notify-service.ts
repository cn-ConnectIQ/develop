import { prisma } from "@connectiq/database";

export async function resolveUserIdForParticipant(participant: {
  phone: string | null;
  email: string | null;
}) {
  if (participant.phone) {
    const byPhone = await prisma.user.findFirst({
      where: { phone: participant.phone },
      select: { id: true },
    });
    if (byPhone) return byPhone.id;
  }
  if (participant.email) {
    const byEmail = await prisma.user.findFirst({
      where: { email: participant.email },
      select: { id: true },
    });
    if (byEmail) return byEmail.id;
  }
  return null;
}

export async function notifyParticipants(input: {
  eventId: string;
  participantIds: string[];
  title: string;
  body: string;
}) {
  const participants = await prisma.participant.findMany({
    where: { eventId: input.eventId, id: { in: input.participantIds } },
    select: { id: true, phone: true, email: true, name: true },
  });

  let sent = 0;
  let skipped = 0;

  for (const p of participants) {
    const userId = await resolveUserIdForParticipant(p);
    if (!userId) {
      skipped += 1;
      continue;
    }
    await prisma.notification.create({
      data: {
        userId,
        title: input.title,
        body: input.body,
      },
    });
    sent += 1;
  }

  return { sent, skipped, total: participants.length };
}

export function participantsToCsv(
  rows: Array<{
    name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    jobTitle: string | null;
    ticketType: string | null;
    checkedInAt: string | null;
    inviteStatus: string;
  }>,
) {
  const header = ["姓名", "手机", "邮箱", "公司", "职位", "票种", "签到时间", "邀请状态"];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.name,
        r.phone ?? "",
        r.email ?? "",
        r.company ?? "",
        r.jobTitle ?? "",
        r.ticketType ?? "",
        r.checkedInAt ?? "",
        r.inviteStatus,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ];
  return lines.join("\n");
}
