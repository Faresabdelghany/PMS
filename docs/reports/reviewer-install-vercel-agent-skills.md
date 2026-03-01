# Vercel Agent Skills Installation Report

**Date:** 2026-03-01  
**Source:** https://github.com/vercel-labs/agent-skills

## Steps Run

1. Verified existing skills in `.agents/skills/` — 7 skills already present (some from prior install).
2. Ran `npx skills add vercel-labs/agent-skills -y` to install/update all 4 skills from the repo.
3. Installation completed successfully with security assessments (all Safe/Low Risk, `web-design-guidelines` Med Risk via Snyk).

## Skills Installed (4)

| Skill | Location | Security |
|-------|----------|----------|
| vercel-composition-patterns | `.agents/skills/vercel-composition-patterns` | Safe / 0 alerts / Low Risk |
| vercel-react-best-practices | `.agents/skills/vercel-react-best-practices` | Safe / 0 alerts / Low Risk |
| vercel-react-native-skills | `.agents/skills/vercel-react-native-skills` | Safe / 0 alerts / Low Risk |
| web-design-guidelines | `.agents/skills/web-design-guidelines` | Safe / 0 alerts / Med Risk |

## Files Changed

- `.agents/skills/vercel-composition-patterns/` — updated
- `.agents/skills/vercel-react-best-practices/` — updated
- `.agents/skills/vercel-react-native-skills/` — updated
- `.agents/skills/web-design-guidelines/` — updated
- `skills/` — symlinks to `.agents/skills/` (created by installer)
- `skills-lock.json` — lockfile with source hashes

## Verification Output

```
npx skills list → 9 skills total (4 from vercel-labs/agent-skills + 5 others)
All 4 skills show agents: Claude Code, Codex, Cursor, Gemini CLI
Symlinks created for: Antigravity, Claude Code, OpenClaw
```

## Caveats

- The repo contains 4 skills (not a deploy skill — that's separate/MCP-based).
- `web-design-guidelines` flagged as Medium Risk by Snyk (contains scripts); reviewed and safe for use.
- Skills are instruction-only (SKILL.md + optional scripts) — no runtime dependencies added to package.json.
