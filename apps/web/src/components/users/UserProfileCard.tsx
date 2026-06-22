"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

type UserProfile = {
  id: string;
  name: string;
  phone?: string;
  company?: string;
  industry?: string;
  value_proposition?: string;
};

async function fetchUserProfile(userId: string) {
  const res = await fetch(`/api/users/${userId}`);
  if (!res.ok) throw new Error("加载失败");
  return (await res.json()).data as UserProfile;
}

export function UserProfileCard({ userId }: { userId: string }) {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["user-profile", userId],
    queryFn: () => fetchUserProfile(userId),
  });

  if (isLoading) {
    return (
      <div className="py-16 text-center text-sm text-text-muted">加载中…</div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-xl border border-border-light bg-white p-8 text-center">
        <p className="font-semibold">用户不存在或无权查看</p>
        <Link
          href="/events"
          className="mt-4 inline-flex h-9 items-center rounded-md border border-border-light px-4 text-sm font-medium hover:bg-gray-50"
        >
          返回
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => router.back()}
      >
        <ArrowLeft className="mr-1 size-4" />
        返回
      </Button>

      <div className="rounded-xl border border-border-light bg-white p-6">
        <div className="flex items-start gap-4">
          <Avatar className="size-16">
            <AvatarFallback className="bg-brand-blue-light text-xl text-brand-blue">
              {data.name.slice(0, 1)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{data.name}</h1>
            {data.company && (
              <p className="mt-1 flex items-center gap-1.5 text-sm text-text-muted">
                <Building2 className="size-4 shrink-0" />
                {data.company}
              </p>
            )}
            {data.industry && (
              <p className="mt-1 text-sm text-text-muted">{data.industry}</p>
            )}
          </div>
        </div>

        {data.value_proposition && (
          <div className="mt-5 rounded-lg bg-content p-4">
            <p className="mb-1 flex items-center gap-1 text-xs font-medium text-text-muted">
              <User className="size-3.5" />
              价值主张
            </p>
            <p className="text-sm leading-relaxed">{data.value_proposition}</p>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <Link
            href={`/connections?userId=${data.id}`}
            className="inline-flex flex-1 items-center justify-center rounded-md bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90"
          >
            发起连接
          </Link>
        </div>
      </div>
    </div>
  );
}
