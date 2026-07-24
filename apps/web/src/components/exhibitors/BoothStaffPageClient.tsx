"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  AdminContent,
  AdminHeader,
  AdminPage,
} from "@/components/admin/admin-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { withPublicPath } from "@/lib/public-path";

type BoothStaffMember = {
  id: string;
  name: string;
  avatar: string | null;
  phone: string | null;
  isBoothOwner: boolean;
  joinedAt: string;
};

type BoothStaffPayload = {
  members: BoothStaffMember[];
  maxCount: number;
  currentCount: number;
  remainingSlots: number;
  viewerIsOwner: boolean;
};

function maskPhone(phone: string | null) {
  if (!phone || phone.length < 7) return phone ?? "—";
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

async function fetchStaff(boothId: string): Promise<BoothStaffPayload> {
  const res = await fetch(withPublicPath(`/api/booths/${boothId}/staff`));
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "加载失败");
  }
  const json = await res.json();
  return json.data as BoothStaffPayload;
}

type Props = {
  boothId: string;
  boothCode: string;
  eventName: string;
  breadcrumb?: string[];
  titlePrefix?: string;
};

export function BoothStaffPageClient({
  boothId,
  boothCode,
  eventName,
  breadcrumb = ["展位设置", "团队成员"],
  titlePrefix = "展位团队成员",
}: Props) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["booth-staff", boothId],
    queryFn: () => fetchStaff(boothId),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["booth-staff", boothId] });
    void queryClient.invalidateQueries({ queryKey: ["booth-staff-summary", boothId] });
  };

  const addMember = useMutation({
    mutationFn: async () => {
      const res = await fetch(withPublicPath(`/api/booths/${boothId}/staff`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), name: name.trim() || undefined }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "添加失败");
      }
    },
    onSuccess: () => {
      toast.success("已添加团队成员");
      setAddOpen(false);
      setPhone("");
      setName("");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMember = useMutation({
    mutationFn: async (participantId: string) => {
      const res = await fetch(
        withPublicPath(`/api/booths/${boothId}/staff/${participantId}`),
        {
          method: "DELETE",
        },
      );
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "移除失败");
      }
    },
    onSuccess: () => {
      toast.success("已移除");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isOwner = data?.viewerIsOwner === true;
  const isFull = data ? data.remainingSlots <= 0 : false;
  const progress =
    data && data.maxCount > 0
      ? Math.min(100, Math.round((data.currentCount / data.maxCount) * 100))
      : 0;

  return (
    <AdminPage>
      <AdminHeader
        title={`${titlePrefix}${titlePrefix.includes(boothCode) ? "" : ` · ${boothCode}`}`}
        description={`${eventName} · ${boothCode}`}
        breadcrumb={breadcrumb}
        actions={
          isOwner ? (
            <Button
              className="bg-brand-green text-white hover:bg-brand-green/90"
              disabled={isFull}
              onClick={() => setAddOpen(true)}
            >
              <UserPlus className="mr-1 size-4" />
              {isFull ? `名额已满（${data?.currentCount}/${data?.maxCount}）` : "添加团队成员"}
            </Button>
          ) : undefined
        }
      />

      <AdminContent>
        {isLoading ? (
          <div className="py-16 text-center text-sm text-text-muted">加载中…</div>
        ) : isError || !data ? (
          <div className="admin-card p-8 text-center">
            <p className="font-semibold">无法加载团队成员</p>
            <button
              type="button"
              className="mt-3 text-sm text-brand-amber hover:underline"
              onClick={() => void refetch()}
            >
              重试
            </button>
          </div>
        ) : (
          <>
            <section className="admin-card p-5">
              <p className="font-semibold">
                已添加 {data.currentCount}/{data.maxCount} 位工作人员
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-border-light">
                <div
                  className="h-full rounded-full bg-brand-green transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {isFull ? (
                <p className="mt-2 text-sm text-text-muted">
                  名额已满，如需更多请联系主办方
                </p>
              ) : null}
            </section>

            {!isOwner ? (
              <p className="mt-4 rounded-xl bg-border-light/60 px-4 py-3 text-sm text-text-muted">
                如需调整团队成员，请联系展位主账号
              </p>
            ) : null}

            <ul className="admin-card mt-4 divide-y divide-border-light">
              {data.members.map((member) => (
                <li
                  key={member.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4"
                >
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-brand-green-light text-brand-green">
                      {member.name.slice(0, 1)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{member.name}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          member.isBoothOwner
                            ? "bg-brand-green-light text-brand-green"
                            : "bg-border-light text-text-muted",
                        )}
                      >
                        {member.isBoothOwner ? (
                          <>
                            <Crown className="mr-0.5 inline size-3" />
                            主账号
                          </>
                        ) : (
                          "团队成员"
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-text-muted">{maskPhone(member.phone)}</p>
                  </div>
                  {isOwner && !member.isBoothOwner ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-brand-red hover:text-brand-red"
                      disabled={removeMember.isPending}
                      onClick={() => {
                        if (
                          window.confirm(`确认将「${member.name}」移出展位团队？`)
                        ) {
                          removeMember.mutate(member.id);
                        }
                      }}
                    >
                      移除
                    </Button>
                  ) : null}
                </li>
              ))}
              {data.members.length === 0 ? (
                <li className="px-5 py-10 text-center text-sm text-text-muted">
                  暂无团队成员
                </li>
              ) : null}
            </ul>
          </>
        )}
      </AdminContent>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加团队成员</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="staff-phone">手机号</Label>
              <Input
                id="staff-phone"
                placeholder="请输入手机号"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-name">姓名（可选）</Label>
              <Input
                id="staff-name"
                placeholder="便于识别团队成员"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              取消
            </Button>
            <Button
              className="bg-brand-green text-white hover:bg-brand-green/90"
              disabled={addMember.isPending || !/^1\d{10}$/.test(phone.trim())}
              onClick={() => addMember.mutate()}
            >
              {addMember.isPending ? "添加中…" : "添加"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminPage>
  );
}
