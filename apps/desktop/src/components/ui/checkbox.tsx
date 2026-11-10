import * as React from "react"
import { Check } from "@phosphor-icons/react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

interface CheckboxProps extends Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, "checked"> {
  checked?: boolean | string
}

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, checked, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    checked={checked === true || checked === "true"}
    className={[
      "shrink-0 rounded-sm border border-bd bg-bg text-acc focus:border-acc focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-acc data-[state=checked]:text-bg",
      className,
    ].join(" ")}
    {...props}
  >
    <CheckboxPrimitive.Indicator asChild>
      <Check className="size-4" weight="bold" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
))
Checkbox.displayName = CheckboxPrimitive.Root.displayName

export { Checkbox }
