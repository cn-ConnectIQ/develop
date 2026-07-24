"use client";

import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  ENABLE_INTERNAL_SELF_REGISTER,
  selfRegisterPath,
} from "@/lib/internal-self-register";
import { withPublicPath } from "@/lib/public-path";
import { cn } from "@/lib/utils";

type CopySelfRegisterLinkButtonProps = {
  eventId: string;
  className?: string;
  /** outline（默认）或与顶栏主按钮并列时可用 ghost */
  variant?: "outline" | "ghost" | "default";
  size?: "default" | "sm";
};

/** 内部测试：复制公开报名链接。正式能力上线前由 ENABLE_INTERNAL_SELF_REGISTER 关闭。 */
export function CopySelfRegisterLinkButton({
  eventId,
  className,
  variant = "outline",
  size = "default",
}: CopySelfRegisterLinkButtonProps) {
  if (!ENABLE_INTERNAL_SELF_REGISTER) return null;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn(className)}
      onClick={async () => {
        const url = `${window.location.origin}${withPublicPath(selfRegisterPath(eventId))}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success("已复制报名链接（内部测试）", {
            action: {
              label: "打开",
              onClick: () => window.open(url, "_blank", "noopener"),
            },
          });
        } catch {
          window.open(url, "_blank", "noopener");
          toast.message("已打开报名页，可从地址栏复制链接");
        }
      }}
    >
      <Link2 className="mr-1 size-4" />
      报名链接
    </Button>
  );
}
