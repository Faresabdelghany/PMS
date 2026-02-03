"use client"

import { Button } from "@/components/ui/button"

interface TaskReactionsProps {
  onSelect: (emoji: string) => void
}

// Common reactions - keeping it simple without external dependencies
const COMMON_REACTIONS = [
  { emoji: "👍", label: "Thumbs up" },
  { emoji: "👎", label: "Thumbs down" },
  { emoji: "❤️", label: "Heart" },
  { emoji: "🎉", label: "Celebration" },
  { emoji: "😄", label: "Smile" },
  { emoji: "😕", label: "Confused" },
  { emoji: "👀", label: "Eyes" },
  { emoji: "🚀", label: "Rocket" },
  { emoji: "✅", label: "Check" },
  { emoji: "🔥", label: "Fire" },
  { emoji: "💯", label: "100" },
  { emoji: "⭐", label: "Star" },
]

export function TaskReactions({ onSelect }: TaskReactionsProps) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {COMMON_REACTIONS.map(({ emoji, label }) => (
        <Button
          key={emoji}
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-lg hover:bg-muted"
          onClick={() => onSelect(emoji)}
          title={label}
        >
          {emoji}
        </Button>
      ))}
    </div>
  )
}
