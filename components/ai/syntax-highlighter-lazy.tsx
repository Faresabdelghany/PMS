"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

// Lazy-loaded syntax highlighter using PrismLight for minimal bundle size
// Only loads the specific languages needed (~100KB vs 1.4MB with full Prism)
// Languages are registered on-demand when the component loads

const SyntaxHighlighterInternal = dynamic(
  () =>
    Promise.all([
      import("react-syntax-highlighter/dist/esm/prism-light"),
      import("react-syntax-highlighter/dist/esm/styles/prism/one-dark"),
      // Core web languages
      import("react-syntax-highlighter/dist/esm/languages/prism/javascript"),
      import("react-syntax-highlighter/dist/esm/languages/prism/typescript"),
      import("react-syntax-highlighter/dist/esm/languages/prism/jsx"),
      import("react-syntax-highlighter/dist/esm/languages/prism/tsx"),
      // Backend languages
      import("react-syntax-highlighter/dist/esm/languages/prism/python"),
      import("react-syntax-highlighter/dist/esm/languages/prism/go"),
      import("react-syntax-highlighter/dist/esm/languages/prism/java"),
      import("react-syntax-highlighter/dist/esm/languages/prism/sql"),
      // Shell/CLI
      import("react-syntax-highlighter/dist/esm/languages/prism/bash"),
      // Data/Config
      import("react-syntax-highlighter/dist/esm/languages/prism/json"),
      import("react-syntax-highlighter/dist/esm/languages/prism/yaml"),
      import("react-syntax-highlighter/dist/esm/languages/prism/markdown"),
      // Markup/Styles
      import("react-syntax-highlighter/dist/esm/languages/prism/css"),
      import("react-syntax-highlighter/dist/esm/languages/prism/scss"),
      import("react-syntax-highlighter/dist/esm/languages/prism/markup"),
    ]).then(
      ([
        prismLight,
        oneDarkStyle,
        javascript,
        typescript,
        jsx,
        tsx,
        python,
        go,
        java,
        sql,
        bash,
        json,
        yaml,
        markdown,
        css,
        scss,
        markup,
      ]) => {
        const PrismLight = prismLight.default

        // Register all languages
        PrismLight.registerLanguage("javascript", javascript.default)
        PrismLight.registerLanguage("js", javascript.default)
        PrismLight.registerLanguage("typescript", typescript.default)
        PrismLight.registerLanguage("ts", typescript.default)
        PrismLight.registerLanguage("jsx", jsx.default)
        PrismLight.registerLanguage("tsx", tsx.default)
        PrismLight.registerLanguage("python", python.default)
        PrismLight.registerLanguage("py", python.default)
        PrismLight.registerLanguage("go", go.default)
        PrismLight.registerLanguage("golang", go.default)
        PrismLight.registerLanguage("java", java.default)
        PrismLight.registerLanguage("sql", sql.default)
        PrismLight.registerLanguage("bash", bash.default)
        PrismLight.registerLanguage("shell", bash.default)
        PrismLight.registerLanguage("sh", bash.default)
        PrismLight.registerLanguage("json", json.default)
        PrismLight.registerLanguage("yaml", yaml.default)
        PrismLight.registerLanguage("yml", yaml.default)
        PrismLight.registerLanguage("markdown", markdown.default)
        PrismLight.registerLanguage("md", markdown.default)
        PrismLight.registerLanguage("css", css.default)
        PrismLight.registerLanguage("scss", scss.default)
        PrismLight.registerLanguage("html", markup.default)
        PrismLight.registerLanguage("markup", markup.default)
        PrismLight.registerLanguage("xml", markup.default)

        const style = oneDarkStyle.default

        function SyntaxHighlighterWithStyle({
          language,
          children,
        }: {
          language: string
          children: string
        }) {
          return (
            <PrismLight
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
            </PrismLight>
          )
        }

        return { default: SyntaxHighlighterWithStyle }
      }
    ),
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
