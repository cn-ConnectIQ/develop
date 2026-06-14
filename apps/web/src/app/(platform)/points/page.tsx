import { redirect } from "next/navigation";

export default function LegacyPointsRedirect() {
  redirect("/platform/points");
}
