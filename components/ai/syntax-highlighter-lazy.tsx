"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy-loaded syntax highlighter to reduce initial bundle size
// react-syntax-highlighter + prism languages are ~1MB+
// Only loaded when code blocks are actually rendered

const SyntaxHighlighterInternal = dynamic(
  () =>
    import("react-syntax-highlighter").then((mod) => {
      // Also dynamically import the style
      return import("react-syntax-highlighter/dist/cjs/styles/prism").then(
        (styles) => {
          // Create a wrapper component that includes the style
          const Highlighter = mod.Prism
          const style = styles.oneDark

          function SyntaxHighlighterWithStyle({
            language,
            children,
          }: {
            language: string
            children: string
          }) {
            return (
              <Highlighter
                style={style as { [key: string]: React.CSSProperties }}
                language={language}
                PreTag="div"
                className="rounded-lg !my-0 text-sm"
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  fontSize: "0.875rem",
                }}
              >
                {children}
              </Highlighter>
            )
          }

          return { default: SyntaxHighlighterWithStyle }
        }
      )
    }),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-lg bg-[#282c34] p-4">
        <Skeleton className="h-4 w-3/4 bg-gray-700" />
        <Skeleton className="h-4 w-1/2 mt-2 bg-gray-700" />
        <Skeleton className="h-4 w-2/3 mt-2 bg-gray-700" />
      </div>
    ),
  }
)

interface LazySyntaxHighlighterProps {
  language: string
  children: string
}

export function LazySyntaxHighlighter({
  language,
  children,
}: LazySyntaxHighlighterProps) {
  return (
    <SyntaxHighlighterInternal language={language}>
      {children}
    </SyntaxHighlighterInternal>
  )
}
