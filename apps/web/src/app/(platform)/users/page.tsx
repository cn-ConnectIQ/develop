import { redirect } from "next/navigation";

export default function LegacyUsersRedirect() {
  redirect("/platform/users");
}
