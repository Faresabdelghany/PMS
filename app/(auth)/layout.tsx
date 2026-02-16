import Link from "next/link"
import { FolderKanban } from "lucide-react"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_1.1fr]">
      {/* Left Panel — Pure CSS visual, zero images, zero JS animations */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-[#08080f]">
        {/* Static radial gradients — one-time paint, composited once */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 70% 50% at 15% 85%, oklch(0.30 0.16 270 / 0.55), transparent 70%),
              radial-gradient(ellipse 50% 40% at 85% 15%, oklch(0.25 0.12 320 / 0.40), transparent 70%),
              radial-gradient(ellipse 40% 30% at 50% 50%, oklch(0.20 0.10 250 / 0.25), transparent 60%)
            `,
          }}
        />

        {/* Dot grid pattern — pure CSS, single paint */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Diagonal line accent — pure CSS */}
        <div
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent,
              transparent 80px,
              rgba(255,255,255,0.15) 80px,
              rgba(255,255,255,0.15) 81px
            )`,
          }}
        />

        {/* Top — Logo */}
        <div className="relative z-10 p-10">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/[0.07] border border-white/[0.06] transition-colors group-hover:bg-white/[0.12]">
              <FolderKanban className="w-5 h-5 text-white/80" />
            </div>
            <span className="text-lg font-medium text-white/80 tracking-tight">PM Tools</span>
          </Link>
        </div>

        {/* Bottom — Copy + social proof */}
        <div className="relative z-10 p-10 space-y-8">
          <div className="max-w-md space-y-4">
            <h1 className="text-[2.5rem] leading-[1.1] font-bold text-white tracking-tight">
              Where teams
              <br />
              ship faster.
            </h1>
            <p className="text-[15px] text-white/45 leading-relaxed max-w-sm">
              The project management platform built for teams who care about velocity, clarity, and craft.
            </p>
          </div>

          {/* Metrics strip — static, no animations */}
          <div className="flex items-center gap-8 pt-2">
            {[
              { value: "10k+", label: "Teams" },
              { value: "99.9%", label: "Uptime" },
              { value: "4.9", label: "Rating" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-xl font-semibold text-white/85 tabular-nums">{stat.value}</div>
                <div className="text-[11px] text-white/30 uppercase tracking-wider mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Form */}
      <main className="relative flex items-center justify-center px-6 py-12 sm:px-12 bg-background">
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

        <div className="w-full max-w-[400px]">
          {children}
        </div>
      </main>
    </div>
  )
}
