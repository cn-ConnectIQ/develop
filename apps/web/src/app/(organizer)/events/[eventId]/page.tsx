import { prisma } from "@connectiq/database";
import { UserRole } from "@connectiq/types";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { EventDashboardClient } from "./event-dashboard-client";

export default async function EventPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const session = await getServerSession(authOptions);

  if (
    session?.user.userType !== "ACCOUNT_ADMIN" &&
    session?.user.role === UserRole.EXPO_ORGANIZER
  ) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, type: "EXPO" },
      select: { id: true },
    });
    if (event) {
      redirect(`/expos/${eventId}`);
    }
  }

  return <EventDashboardClient eventId={eventId} />;
}
