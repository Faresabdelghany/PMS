import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { ColorThemeProvider } from "@/components/color-theme-provider"
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration"
import "./globals.css"

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap", // Ensure text remains visible during font load
})
const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: "PM Tools - Project Management",
  description: "Modern project and task management tool with timeline view",
  icons: {
    icon: "/icon.png",
    apple: "/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#3b82f6",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Preconnect to external origins for faster resource loading */}
        <link rel="preconnect" href="https://lazhmdyajdqbnxxwyxun.supabase.co" />
        <link rel="dns-prefetch" href="https://lazhmdyajdqbnxxwyxun.supabase.co" />
        {/* Inline script to prevent color theme flash - runs before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('color-theme');
                  if (theme && theme !== 'default') {
                    document.documentElement.setAttribute('data-color-theme', theme);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ColorThemeProvider>
            <ServiceWorkerRegistration />
            {children}
            <Analytics />
            <SpeedInsights />
            <Toaster richColors closeButton />
          </ColorThemeProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
