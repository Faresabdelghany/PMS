# AGENTS.md — PMS Agent Guide

Use this file before making changes in this repo.

## Next.js Source of Truth

<!-- BEGIN:nextjs-agent-rules -->
- PMS runs **Next.js 16.1.6** (`package.json`).
- Do **not** use `./.next-docs` as a required docs source in this repo (that path is not present).
- Preferred docs source order:
  1. `node_modules/next/dist/docs` (if present in current installed `next`)
  2. Official docs: `https://nextjs.org/docs` (match to installed version)
- If you need to refresh the Next.js agent section after upgrades, run:
  - `npx @next/codemod agents-md --output AGENTS.md`
  - then re-apply PMS custom rules below if codemod overwrites them.
<!-- END:nextjs-agent-rules -->

## PMS-Specific Conventions (follow these)

- **App Router route groups:**
  - Auth pages live in `app/(auth)`
  - Product/dashboard pages live in `app/(dashboard)`
- **Client wrappers in routes:** prefer `*-client.tsx` for route-level client components (existing pattern in dashboard pages).
- **Page auth:** use `getPageOrganization()` in dashboard pages.
- **Server action auth:** use `requireAuth()` + `requireOrgMember()`.
- **Cache invalidation:** use `invalidateCache.*` helpers from `lib/cache`; avoid ad-hoc `revalidatePath()` in features.
- **UI consistency:** reuse existing task/project components; do not rebuild existing major UI blocks when extension is possible.

## MCP for Agent-Assisted Debugging

- Use `next-devtools-mcp` from `.mcp.json`.
- Start dev server (`npm run dev`) before invoking Next MCP tools.
- MCP endpoint is dev-only (`/_next/mcp`); never depend on it in production behavior.

## Local Checklist Before Marking Work Done

- Run type/build checks when feasible:
  - `npx tsc --noEmit`
  - `npm run build`
- Keep edits minimal and scoped.
- Update docs when adding new workflow/config behavior.
