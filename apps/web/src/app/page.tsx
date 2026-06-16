import { authOptions } from "@/lib/auth";
import { getPostLoginRedirectPath } from "@/lib/auth-redirect";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  redirect(getPostLoginRedirectPath(session.user));
}
