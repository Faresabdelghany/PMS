"use client"

import { useState } from "react"
import { Copy, Check } from "@phosphor-icons/react/dist/ssr"
import { cn } from "@/lib/utils"

interface CopyButtonProps {
  text: string
  className?: string
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text:", err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "absolute top-2 right-2 p-1.5 rounded-md",
        "bg-background/80 backdrop-blur-sm border border-border/50",
        "opacity-0 group-hover:opacity-100 transition-opacity",
        "hover:bg-muted",
        className
      )}
      aria-label={copied ? "Copied!" : "Copy code"}
    >
      {copied ? (
        <Check className="size-4 text-green-500" weight="bold" />
      ) : (
        <Copy className="size-4 text-muted-foreground" />
      )}
    </button>
  )
}
