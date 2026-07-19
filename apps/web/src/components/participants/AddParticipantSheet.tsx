"use client";

import { useState } from "react";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { withPublicPath } from "@/lib/public-path";

const schema = z.object({
  name: z.string().min(1, "请输入姓名"),
  phone: z.string().min(1, "请输入手机号"),
  email: z.string().email("邮箱格式不正确").optional().or(z.literal("")),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type AddParticipantSheetProps = {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function AddParticipantSheet({
  eventId,
  open,
  onOpenChange,
  onSuccess,
}: AddParticipantSheetProps) {
  const [submitting, setSubmitting] = useState(false);

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

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch(
        withPublicPath(`/api/events/${eventId}/participants`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name.trim(),
            phone: values.phone.trim(),
            email: values.email?.trim() || undefined,
            company: values.company?.trim() || undefined,
            jobTitle: values.jobTitle?.trim() || undefined,
          }),
        },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          typeof json.error === "string" ? json.error : "添加失败",
        );
        return;
      }
      toast.success("参会者已添加");
      form.reset();
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
          <SheetTitle>手动添加参会者</SheetTitle>
          <SheetDescription>
            填写基本信息后即可加入本场名单，后续可发送邀请。
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-6 flex flex-1 flex-col space-y-5"
        >
          <div className="space-y-2">
            <Label htmlFor="add-name">姓名 *</Label>
            <Input
              id="add-name"
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
            <Label htmlFor="add-phone">手机号 *</Label>
            <Input
              id="add-phone"
              placeholder="11 位手机号"
              inputMode="tel"
              {...form.register("phone")}
            />
            {form.formState.errors.phone ? (
              <p className="text-xs text-brand-red">
                {form.formState.errors.phone.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-email">邮箱</Label>
            <Input
              id="add-email"
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
              <Label htmlFor="add-company">公司</Label>
              <Input
                id="add-company"
                placeholder="可选"
                {...form.register("company")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="add-job">职位</Label>
              <Input
                id="add-job"
                placeholder="可选"
                {...form.register("jobTitle")}
              />
            </div>
          </div>
          <div className="mt-auto pt-2">
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "保存中..." : "添加参会者"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
