import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green/25 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-surface-secondary text-text-secondary",
        secondary: "bg-surface-secondary text-text-secondary",
        success: "bg-brand-green-soft text-brand-green",
        warning: "bg-brand-amber-light text-brand-amber",
        danger: "bg-brand-red-light text-brand-red",
        destructive: "bg-brand-red-light text-brand-red",
        info: "bg-brand-blue-light text-brand-blue",
        purple: "bg-ai-purple-soft text-ai-purple",
        outline:
          "border border-border bg-surface text-text-secondary",
        ghost:
          "bg-transparent text-text-secondary hover:bg-surface-secondary",
        link: "text-brand-green underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
