"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
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

const schema = z.object({
  phone: z.string().regex(/^1[3-9]\d{9}$/, "请输入有效手机号"),
  code: z.string().min(4, "请输入验证码"),
});

type FormValues = z.infer<typeof schema>;

type PhoneAuthSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function PhoneAuthSheet({
  open,
  onOpenChange,
  onSuccess,
}: PhoneAuthSheetProps) {
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: "", code: "" },
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  async function sendCode() {
    const valid = await form.trigger("phone");
    if (!valid) return;

    setError(null);
    const res = await fetch("/api/auth/send-sms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: form.getValues("phone") }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "发送失败");
      return;
    }
    setCountdown(60);
  }

  async function submit(values: FormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await signIn("phone", {
        phone: values.phone,
        code: values.code,
        redirect: false,
      });
      if (result?.error) {
        setError("验证码错误或已过期");
        return;
      }
      onOpenChange(false);
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>验证手机号参与互动</SheetTitle>
          <SheetDescription>
            输入手机号获取验证码，即可参与本次互动
          </SheetDescription>
        </SheetHeader>

        <form
          className="mt-6 space-y-4 pb-4"
          onSubmit={(e) => void form.handleSubmit(submit)(e)}
        >
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input
              id="phone"
              inputMode="numeric"
              placeholder="请输入手机号"
              {...form.register("phone")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="code">验证码</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                inputMode="numeric"
                placeholder="6 位验证码"
                {...form.register("code")}
              />
              <Button
                type="button"
                variant="outline"
                className="shrink-0"
                disabled={countdown > 0}
                onClick={() => void sendCode()}
              >
                {countdown > 0 ? `${countdown}s` : "获取验证码"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button
            type="submit"
            className="h-11 w-full rounded-xl bg-brand-blue hover:bg-brand-blue/90"
            disabled={submitting}
          >
            {submitting ? "验证中..." : "确认参与"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
