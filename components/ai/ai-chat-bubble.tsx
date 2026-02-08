"use client"

import { StarFour } from "@phosphor-icons/react/dist/ssr/StarFour"
import { MotionDiv } from "@/components/ui/motion-lazy"
import { cn } from "@/lib/utils"

// =============================================================================
// Types
// =============================================================================

interface AIChatBubbleProps {
  onClick: () => void
  hasUnread?: boolean
  messageCount?: number
}

// =============================================================================
// Component
// =============================================================================

export function AIChatBubble({ onClick, hasUnread, messageCount = 0 }: AIChatBubbleProps) {
  return (
    <MotionDiv
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 20 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="fixed bottom-6 right-6 z-50"
    >
      <button
        onClick={onClick}
        className={cn(
          "group relative flex items-center gap-2.5 rounded-2xl px-4 py-3",
          "bg-background border border-border shadow-lg",
          "hover:shadow-xl hover:border-violet-500/30 transition-all duration-200 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2"
        )}
        aria-label="Open AI chat"
      >
        {/* Icon with subtle pulse animation when has unread */}
        <div className={cn(
          "relative flex items-center justify-center size-9 rounded-xl bg-violet-500/10",
          hasUnread && "animate-pulse motion-reduce:animate-none"
        )}>
          <StarFour weight="fill" className="size-5 text-violet-500" />

          {/* Unread indicator dot */}
          {hasUnread && (
            <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-violet-500 ring-2 ring-background" />
          )}
        </div>

        {/* Label */}
        <div className="flex flex-col items-start">
          <span className="text-sm font-medium text-foreground">AI Assistant</span>
          {messageCount > 0 && (
            <span className="text-xs text-muted-foreground">
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Hover expand indicator */}
        <div className="ml-1 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="rotate-45">
            <path d="M2 10L10 2M10 2H4M10 2V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </button>
    </MotionDiv>
  )
}
