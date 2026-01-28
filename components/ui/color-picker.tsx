"use client"

import { cn } from "@/lib/utils"
import { TAG_COLORS } from "@/lib/actions/tags"

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
  className?: string
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  return (
    <div className={cn("grid grid-cols-8 gap-2", className)}>
      {TAG_COLORS.map((color) => (
        <button
          key={color.hex}
          type="button"
          className={cn(
            "h-6 w-6 rounded-md border-2 transition-all hover:scale-110",
            value === color.hex
              ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background"
              : "border-transparent"
          )}
          style={{ backgroundColor: color.hex }}
          onClick={() => onChange(color.hex)}
          title={color.name}
        />
      ))}
    </div>
  )
}
