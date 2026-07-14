import Image from "next/image";
import { cn } from "@/lib/utils";
import { withPublicPath } from "@/lib/public-path";
import brandLogo from "../../../public/brand/jiuli-logo.png";

/** 对外绝对路径（含 /uc）；静态资源直链兜底 */
export const BRAND_LOGO_PATH = withPublicPath("/brand/jiuli-logo.png");

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

/**
 * 使用静态 import，保证 standalone 部署下走 `/_next/static/media/*`，
 * 不依赖运行时 public 目录（CloudBase 曾出现 public 裂图）。
 */
export function BrandLogo({ size = 32, className, priority }: BrandLogoProps) {
  return (
    <Image
      src={brandLogo}
      alt="玖莅"
      width={size}
      height={size}
      priority={priority}
      unoptimized
      className={cn("shrink-0 rounded-[8px] object-cover", className)}
    />
  );
}
