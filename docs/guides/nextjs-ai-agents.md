# Next.js AI Agent Setup (PMS)

## What was configured

- `AGENTS.md` now uses a valid docs strategy for this repo (no hard dependency on missing `./.next-docs`).
- `.mcp.json` now includes `next-devtools` via `next-devtools-mcp`.

## Use Next DevTools MCP

1. Start Next dev server:

```bash
npm run dev
```

2. Use MCP client tools through the `next-devtools` server from `.mcp.json`.

- Package: `next-devtools-mcp@latest`
- Dev endpoint used by the MCP server: `/_next/mcp` (development only)

## Notes

- PMS is currently on Next.js `16.1.6`.
- If `node_modules/next/dist/docs` is present in your installed Next version, prefer it for version-matched docs.
- Otherwise use https://nextjs.org/docs aligned to installed version.
