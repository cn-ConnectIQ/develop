import { UserProfileCard } from "@/components/users/UserProfileCard";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  return (
    <div className="min-h-screen bg-content px-4 py-8">
      <UserProfileCard userId={userId} />
    </div>
  );
}
