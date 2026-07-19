"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { withPublicPath } from "@/lib/public-path";
import type { ParticipantListItem } from "@/lib/participants";

const schema = z.object({
  name: z.string().min(1, "请输入姓名"),
  phone: z.string().min(1, "请输入手机号"),
  email: z.string().email("邮箱格式不正确").optional().or(z.literal("")),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type EditParticipantSheetProps = {
  eventId: string;
  participant: ParticipantListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function EditParticipantSheet({
  eventId,
  participant,
  open,
  onOpenChange,
  onSuccess,
}: EditParticipantSheetProps) {
  const [submitting, setSubmitting] = useState(false);
  const phoneLocked = participant?.inviteStatus === "ACTIVATED";

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      company: "",
      jobTitle: "",
    },
  });

  useEffect(() => {
    if (!participant || !open) return;
    form.reset({
      name: participant.name ?? "",
      phone: participant.phone ?? "",
      email: participant.email ?? "",
      company: participant.company ?? "",
      jobTitle: participant.jobTitle ?? "",
    });
  }, [participant, open, form]);

  async function onSubmit(values: FormValues) {
    if (!participant) return;
    setSubmitting(true);
    try {
      const body: Record<string, string | null> = {
        name: values.name.trim(),
        email: values.email?.trim() || null,
        company: values.company?.trim() || null,
        jobTitle: values.jobTitle?.trim() || null,
      };
      if (!phoneLocked) {
        body.phone = values.phone.trim();
      }

      const res = await fetch(
        withPublicPath(
          `/api/events/${eventId}/participants/${participant.id}`,
        ),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof json.error === "string" ? json.error : "保存失败",
        );
        return;
      }
      toast.success("参会者信息已更新");
      onOpenChange(false);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>编辑参会者</SheetTitle>
          <SheetDescription>
            {phoneLocked
              ? "该参会者已激活，手机号不可修改。"
              : "修改后将同步到本场邀请记录。"}
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-6 flex flex-1 flex-col space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="edit-name">姓名 *</Label>
            <Input
              id="edit-name"
              placeholder="例如：张三"
              {...form.register("name")}
            />
            {form.formState.errors.name ? (
              <p className="text-xs text-brand-red">
                {form.formState.errors.name.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">手机号 *</Label>
            <Input
              id="edit-phone"
              placeholder="11 位手机号"
              inputMode="tel"
              {...form.register("phone")}
              disabled={phoneLocked}
              className={
                phoneLocked ? "bg-surface-secondary text-text-tertiary" : undefined
              }
            />
            {phoneLocked ? (
              <p className="text-xs text-text-tertiary">
                已激活账号绑定此手机号，无法更改
              </p>
            ) : form.formState.errors.phone ? (
              <p className="text-xs text-brand-red">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-email">邮箱</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="可选"
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <p className="text-xs text-brand-red">
                {form.formState.errors.email.message}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="edit-company">公司</Label>
              <Input
                id="edit-company"
                placeholder="可选"
                {...form.register("company")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-job">职位</Label>
              <Input
                id="edit-job"
                placeholder="可选"
                {...form.register("jobTitle")}
              />
            </div>
          </div>
          <div className="mt-auto pt-2">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "保存中..." : "保存修改"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
