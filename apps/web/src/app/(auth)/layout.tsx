import { authOptions } from "@/lib/auth";
import { getPostLoginRedirectPath } from "@/lib/auth-redirect";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  const userType = session?.user?.userType;
  if (
    session?.user &&
    (userType === "PLATFORM_ADMIN" || userType === "ACCOUNT_ADMIN")
  ) {
    redirect(getPostLoginRedirectPath(session.user));
  }

  return <>{children}</>;
}
