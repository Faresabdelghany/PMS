import Link from "next/link"
import { FolderKanban } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Define float keyframes — referenced by gradient orbs and geometric shapes */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
      `}} />

      <div className="min-h-screen grid lg:grid-cols-2">
        {/* Left Panel - Animated Gradient Background */}
        <div className="relative hidden lg:flex flex-col items-center justify-center overflow-hidden bg-[#0a0a12]">
          {/* Animated gradient orbs — use smaller sizes and lighter blur for faster paint */}
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-1/4 -left-1/4 w-[400px] h-[400px] rounded-full bg-gradient-to-br from-violet-600/40 via-indigo-600/30 to-transparent blur-2xl"
              style={{ animation: 'float 8s ease-in-out infinite', willChange: 'transform', contain: 'layout style' }}
            />
            <div
              className="absolute top-1/2 -right-1/4 w-[350px] h-[350px] rounded-full bg-gradient-to-bl from-fuchsia-600/30 via-purple-600/20 to-transparent blur-2xl"
              style={{ animation: 'float 10s ease-in-out infinite reverse', willChange: 'transform', contain: 'layout style' }}
            />
            <div
              className="absolute -bottom-1/4 left-1/3 w-[300px] h-[300px] rounded-full bg-gradient-to-tr from-blue-600/25 via-cyan-600/15 to-transparent blur-2xl"
              style={{ animation: 'float 12s ease-in-out infinite', willChange: 'transform', contain: 'layout style' }}
            />
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                               linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
              backgroundSize: '64px 64px'
            }}
          />

          {/* Floating geometric shapes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute w-2 h-2 bg-white/10 rounded-full"
                style={{
                  left: `${20 + i * 25}%`,
                  top: `${25 + (i % 2) * 30}%`,
                  animation: `float ${8 + i * 3}s ease-in-out infinite`,
                  animationDelay: `${i * 0.5}s`,
                  willChange: 'transform',
                }}
              />
            ))}
          </div>

          {/* Content */}
          <div className="relative z-10 max-w-lg px-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-12">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-indigo-600 blur-lg opacity-50" />
                <div className="relative flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-500/25">
                  <FolderKanban className="w-6 h-6 text-white" />
                </div>
              </div>
              <span className="text-2xl font-semibold text-white tracking-tight">PM Tools</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight mb-6 tracking-tight">
              Ship projects
              <span className="block mt-1 bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent">
                faster together
              </span>
            </h1>

            <p className="text-lg text-white/60 leading-relaxed mb-12">
              The modern project management platform that helps teams collaborate, track progress, and deliver exceptional work.
            </p>

            {/* Feature highlights — reduced animation delays for faster LCP */}
            <div className="space-y-4">
              {[
                { label: "Real-time collaboration", desc: "Work together seamlessly" },
                { label: "Smart task tracking", desc: "Never miss a deadline" },
                { label: "AI-powered insights", desc: "Make data-driven decisions" },
              ].map((feature, i) => (
                <div
                  key={feature.label}
                  className="flex items-center gap-4 animate-in fade-in slide-in-from-left-4 duration-300"
                  style={{ animationDelay: `${200 + i * 80}ms`, animationFillMode: 'backwards' }}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{feature.label}</div>
                    <div className="text-sm text-white/40">{feature.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom attribution */}
          <div className="absolute bottom-8 left-12 text-sm text-white/30 animate-in fade-in duration-500 delay-300">
            Trusted by 10,000+ teams worldwide
          </div>
        </div>

        {/* Right Panel - Form */}
        <main className="relative flex items-center justify-center p-6 sm:p-12 bg-background">
          {/* Subtle gradient accent — reduced from blur-3xl to blur-2xl */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/5 via-transparent to-transparent rounded-full blur-2xl pointer-events-none" />

          {/* Mobile logo */}
          <Link
            href="/"
            className="absolute top-6 left-6 lg:hidden flex items-center gap-2"
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-semibold tracking-tight">PM Tools</span>
          </Link>

          <div className="w-full max-w-[420px] animate-in fade-in slide-in-from-bottom-4 duration-300">
            {children}
          </div>
        </main>
      </div>
    </>
  )
}
