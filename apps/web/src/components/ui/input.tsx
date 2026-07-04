import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-border bg-surface px-3 py-1 text-sm text-text-primary transition-[border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text-primary placeholder:text-text-tertiary focus-visible:border-[1.5px] focus-visible:border-brand-green focus-visible:shadow-sm disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface-secondary disabled:opacity-50 aria-invalid:border-danger aria-invalid:focus-visible:border-danger",
        className
      )}
      {...props}
    />
  )
}

export { Input }
