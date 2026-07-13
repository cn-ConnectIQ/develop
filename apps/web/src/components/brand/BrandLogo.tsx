import Image from "next/image";
import { cn } from "@/lib/utils";

export const BRAND_LOGO_PATH = "/brand/jiuli-logo.png";

type BrandLogoProps = {
  size?: number;
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ size = 32, className, priority }: BrandLogoProps) {
  return (
    <Image
      src={BRAND_LOGO_PATH}
      alt="玖莅"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 rounded-[8px] object-cover", className)}
    />
  );
}
