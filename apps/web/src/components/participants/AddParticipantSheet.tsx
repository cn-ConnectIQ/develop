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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
      const res = await fetch(`/api/events/${eventId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "添加失败");
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
      <SheetContent className="w-full sm:max-w-[480px]">
        <SheetHeader>
          <SheetTitle>手动添加参会者</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-6 space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="add-name">姓名 *</Label>
            <Input id="add-name" {...form.register("name")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-phone">手机号 *</Label>
            <Input id="add-phone" {...form.register("phone")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-email">邮箱</Label>
            <Input id="add-email" type="email" {...form.register("email")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-company">公司</Label>
            <Input id="add-company" {...form.register("company")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="add-job">职位</Label>
            <Input id="add-job" {...form.register("jobTitle")} />
          </div>
          <Button
            type="submit"
            className="w-full bg-brand-blue text-white hover:bg-brand-blue/90"
            disabled={submitting}
          >
            {submitting ? "保存中..." : "添加参会者"}
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
