"use client"

import { useMemo } from "react"
import ReactMarkdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"
import { LazySyntaxHighlighter } from "./syntax-highlighter-lazy"
import { CopyButton } from "./copy-button"
import { cn } from "@/lib/utils"

interface MarkdownContentProps {
  content: string
  className?: string
}

// Memoized components factory to prevent re-renders
function createMarkdownComponents(): Components {
  return {
    // Code blocks with syntax highlighting
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "")
      const codeString = String(children).replace(/\n$/, "")

      // Check if this is an inline code or a code block
      const isInline = !match && !codeString.includes("\n")

      if (isInline) {
        return (
          <code
            className="bg-muted px-1.5 py-0.5 rounded text-[0.9em] font-mono"
            {...props}
          >
            {children}
          </code>
        )
      }

      // Code block with syntax highlighting (lazy loaded)
      return (
        <div className="relative group not-prose my-3">
          <LazySyntaxHighlighter language={match?.[1] || "text"}>
            {codeString}
          </LazySyntaxHighlighter>
          <CopyButton text={codeString} />
        </div>
      )
    },

    // Paragraphs
    p({ children }) {
      return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
    },

    // Lists
    ul({ children }) {
      return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
    },
    ol({ children }) {
      return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
    },
    li({ children }) {
      return <li className="leading-relaxed">{children}</li>
    },

    // Headings
    h1({ children }) {
      return <h1 className="text-lg font-semibold mt-4 mb-2 first:mt-0">{children}</h1>
    },
    h2({ children }) {
      return <h2 className="text-base font-semibold mt-3 mb-2 first:mt-0">{children}</h2>
    },
    h3({ children }) {
      return <h3 className="text-sm font-semibold mt-3 mb-1 first:mt-0">{children}</h3>
    },

    // Blockquotes
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground my-2">
          {children}
        </blockquote>
      )
    },

    // Links
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {children}
        </a>
      )
    },

    // Tables
    table({ children }) {
      return (
        <div className="overflow-x-auto my-2">
          <table className="min-w-full divide-y divide-border text-sm">
            {children}
          </table>
        </div>
      )
    },
    thead({ children }) {
      return <thead className="bg-muted/50">{children}</thead>
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left font-medium text-foreground">
          {children}
        </th>
      )
    },
    td({ children }) {
      return <td className="px-3 py-2 border-t border-border">{children}</td>
    },

    // Horizontal rule
    hr() {
      return <hr className="my-4 border-border" />
    },

    // Strong and emphasis
    strong({ children }) {
      return <strong className="font-semibold">{children}</strong>
    },
    em({ children }) {
      return <em className="italic">{children}</em>
    },
  }
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  // Memoize components to prevent ReactMarkdown from re-processing on every render
  const components = useMemo(() => createMarkdownComponents(), [])

  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
