import * as React from "react"

interface SwitchProps {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  className?: string
  disabled?: boolean
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    const handleClick = () => {
      if (disabled) return
      onCheckedChange?.(!checked)
    }

    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleClick}
        className={[
          "peer shrink-0 cursor-pointer rounded-full border-2 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-ring/50 disabled:opacity-50 disabled:cursor-not-allowed",
          checked
            ? "h-[20px] w-[36px] border-transparent bg-acc"
            : "h-[20px] w-[36px] border-transparent bg-bg",
          className,
        ].join(" ")}
        {...props}
      >
        <span
          className="pointer-events-none block h-[16px] w-[16px] rounded-full bg-bg shadow-md ring-0 transition-transform duration-200 ease-in-out"
          style={{
            transform: checked ? "translatex(14px)" : "translatex(2px)",
          }}
        />
      </button>
    )
  },
)

Switch.displayName = "Switch"

export { Switch }
