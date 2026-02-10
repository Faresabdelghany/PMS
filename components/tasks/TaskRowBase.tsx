"use client"

import { memo, type ReactNode } from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"

export type TaskRowBaseProps = {
  checked: boolean
  title: string
  onCheckedChange?: () => void
  onTitleClick?: () => void
  titleAriaLabel?: string
  titleSuffix?: ReactNode
  meta?: ReactNode
  className?: string
  subtitle?: ReactNode
}

export const TaskRowBase = memo(function TaskRowBase({
  checked,
  title,
  onCheckedChange,
  onTitleClick,
  titleAriaLabel,
  titleSuffix,
  meta,
  className,
  subtitle,
}: TaskRowBaseProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted/60 [content-visibility:auto] [contain-intrinsic-size:auto_40px]",
        className,
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={titleAriaLabel ?? title}
        className="rounded-full border-border bg-background data-[state=checked]:border-teal-600 data-[state=checked]:bg-teal-600 hover:cursor-pointer"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTitleClick}
            className={cn(
              "flex-1 truncate text-left hover:underline focus:outline-none focus:underline",
              checked && "line-through text-muted-foreground",
              onTitleClick && "cursor-pointer",
            )}
          >
            {title}
          </button>
          {titleSuffix}
        </div>
        {subtitle && (
          <div
            className={cn(
              "mt-0.5 text-xs text-muted-foreground truncate",
              checked && "line-through opacity-70",
            )}
          >
            {subtitle}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        {meta}
      </div>
    </div>
  )
})
