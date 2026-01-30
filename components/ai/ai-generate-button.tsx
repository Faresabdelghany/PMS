"use client"

import { cn } from "@/lib/utils"
import { StarFour, CircleNotch } from "@phosphor-icons/react/dist/ssr"

interface AIGenerateButtonProps {
  onClick: () => void
  isLoading?: boolean
  disabled?: boolean
  label?: string
  loadingLabel?: string
  size?: "sm" | "md"
  className?: string
}

export function AIGenerateButton({
  onClick,
  isLoading = false,
  disabled = false,
  label = "Generate with AI",
  loadingLabel = "Generating...",
  size = "md",
  className,
}: AIGenerateButtonProps) {
  const isDisabled = disabled || isLoading

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full transition-colors",
        "bg-muted-foreground/8 hover:bg-violet-500/20",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        size === "sm"
          ? "h-7 px-3 py-0.5"
          : "h-8 px-4 py-1",
        className
      )}
    >
      <div className={size === "sm" ? "size-3.5" : "size-4"}>
        {isLoading ? (
          <CircleNotch
            weight="bold"
            className={cn(
              "animate-spin text-violet-500",
              size === "sm" ? "size-3.5" : "size-4"
            )}
          />
        ) : (
          <StarFour
            weight="fill"
            className={cn(
              "text-violet-500",
              size === "sm" ? "size-3.5" : "size-4"
            )}
          />
        )}
      </div>
      <span
        className={cn(
          "font-medium text-foreground tracking-wide",
          size === "sm" ? "text-xs" : "text-sm"
        )}
      >
        {isLoading ? loadingLabel : label}
      </span>
    </button>
  )
}
