import { authOptions } from "@/lib/auth";
import { getAdminHomePath } from "@/lib/role-utils";
import { UserRole } from "@connectiq/types";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.role) {
    redirect("/login");
  }

  redirect(
    getAdminHomePath(
      session.user.role as UserRole,
      session.user.entityId ?? null,
      session.user.hasPlatformAdmin,
    ),
  );
}
