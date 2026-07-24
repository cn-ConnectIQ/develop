"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { withPublicPath } from "@/lib/public-path";

const schema = z.object({
  name: z.string().min(1, "请输入姓名"),
  phone: z
    .string()
    .min(1, "请输入手机号")
    .regex(/^1\d{10}$/, "请输入 11 位手机号"),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type RegisterClientProps = {
  eventId: string;
  eventName: string;
};

export function RegisterClient({ eventId, eventName }: RegisterClientProps) {
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      phone: "",
      company: "",
      jobTitle: "",
    },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const res = await fetch(
        withPublicPath(`/api/public/events/${eventId}/self-register`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: values.name.trim(),
            phone: values.phone.trim(),
            company: values.company?.trim() || undefined,
            jobTitle: values.jobTitle?.trim() || undefined,
          }),
        },
      );
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { created?: boolean };
      };
      if (!res.ok) {
        toast.error(
          typeof json.error === "string" ? json.error : "报名失败",
        );
        return;
      }
      setDone(true);
      toast.success(
        json.data?.created === false ? "你已在名单中" : "报名成功",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-6 text-center">
        <CheckCircle2 className="mb-4 size-12 text-emerald-600" />
        <h1 className="text-xl font-semibold text-zinc-900">报名成功</h1>
        <p className="mt-2 text-sm text-zinc-500">
          已加入「{eventName}」名单，可关闭本页。
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-6 py-10">
      <p className="mb-3 text-xs font-medium tracking-wide text-amber-700">
        内部测试报名入口
      </p>
      <h1 className="text-2xl font-semibold text-zinc-900">{eventName}</h1>
      <p className="mt-2 text-sm text-zinc-500">填写信息即可加入本场参会名单</p>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="mt-8 space-y-5"
      >
        <div className="space-y-2">
          <Label htmlFor="reg-name">姓名 *</Label>
          <Input
            id="reg-name"
            placeholder="例如：张三"
            autoComplete="name"
            {...form.register("name")}
          />
          {form.formState.errors.name ? (
            <p className="text-xs text-red-600">
              {form.formState.errors.name.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-phone">手机号 *</Label>
          <Input
            id="reg-phone"
            placeholder="11 位手机号"
            inputMode="tel"
            autoComplete="tel"
            {...form.register("phone")}
          />
          {form.formState.errors.phone ? (
            <p className="text-xs text-red-600">
              {form.formState.errors.phone.message}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-company">公司</Label>
          <Input
            id="reg-company"
            placeholder="选填"
            {...form.register("company")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reg-title">职位</Label>
          <Input
            id="reg-title"
            placeholder="选填"
            {...form.register("jobTitle")}
          />
        </div>
        <Button
          type="submit"
          className="w-full bg-brand-blue text-white hover:bg-brand-blue/90"
          disabled={submitting}
        >
          {submitting ? "提交中…" : "提交报名"}
        </Button>
      </form>
    </div>
  );
}
