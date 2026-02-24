# Product Analyst Report: Task Comments + @Mentions + Notification Daemon

**Date:** 2026-02-24  
**Feature set:** Comments UI, @mention parsing, Notification daemon  
**Parity target:** MissionControlHQ.ai  
**Status:** ✅ Complete — 0 TypeScript errors

---

## Executive Summary

All 3 features have been designed, specified, and implemented. The PMS now supports:
1. Agent task messages visible in the Task Detail Panel
2. Automatic @mention detection that creates agent_notifications in Supabase
3. A Node.js notification daemon that delivers notifications to agent sessions via OpenClaw CLI

---

## Feature 1: Task Comments UI ✅

### What was done
- Integrated `TaskMessagesPanel` into `TaskDetailPanel.tsx`
- Added import for `TaskMessagesPanel` 
- Rendered it between the description divider and the Activity section
- Derived `userId` from existing `organizationMembers` prop — **no call-site changes needed**

### Files changed
| File | Change |
|------|--------|
| `components/tasks/TaskDetailPanel.tsx` | Added `TaskMessagesPanel` import + render block |
| `components/tasks/TaskMessagesPanel.tsx` | Updated placeholder text to mention @AgentName |

### Result
- Any task opened in the TaskDetailPanel now shows an "Agent Messages" section
- Users can post messages that appear in the thread
- Empty state handles gracefully

---

## Feature 2: @Mention Parsing ✅

### What was done
- Added `parseMentions(content)` function to `lib/actions/task-messages.ts`
  - Regex: `/@([A-Za-z][A-Za-z0-9 _-]{0,49})/g`
  - Returns deduplicated array of mentioned names
- Added `handleMentions(orgId, taskId, messageId, content)` helper that:
  - Calls `parseMentions`
  - Queries `agents` table by `name IN (mentions)` and `organization_id = orgId`
  - Inserts rows into `agent_notifications` (`mentioned_agent_id`, `task_id`, `message_id`, `content`, `delivered: false`)
  - Never throws — wrapped in try/catch, errors are logged
- Called `handleMentions` inside `createMessage` after successful insert

### Schema note
The `agent_notifications` table column is `mentioned_agent_id` (not `agent_id` as described in the task brief). Implementation correctly uses `mentioned_agent_id`.

### Files changed
| File | Change |
|------|--------|
| `lib/actions/task-messages.ts` | Added `parseMentions`, `handleMentions`, called inside `createMessage` |

---

## Feature 3: Notification Daemon ✅

### What was done
Created `C:\Users\Fares\.openclaw\workspace\scripts\notification-daemon.js`:

- **Runtime:** Node.js 18+ (uses native `fetch`, no npm dependencies)
- **Polling:** Every 2 seconds via `setInterval`
- **Logic:**
  1. Fetch undelivered `agent_notifications` rows (joined with `agents` for `session_key`)
  2. For each notification: call `openclaw.cmd sessions send --session <sessionKey> --message <content>`
  3. Mark `delivered: true` via PATCH to Supabase REST API
  4. If `session_key` is null/missing: mark delivered to avoid retry loop (logged as warning)
- **Platform-aware:** Uses `openclaw.cmd` on Windows, `openclaw` elsewhere
- **Error handling:** Per-notification try/catch — one failure doesn't stop others

### Usage
```bash
node C:\Users\Fares\.openclaw\workspace\scripts\notification-daemon.js
```

---

## Build Verification

```
pnpm.cmd tsc --noEmit → (no output — 0 TypeScript errors) ✅
pnpm.cmd build → ✓ Compiled successfully in 47s ✅
                  ✓ 34/34 static pages generated ✅
                  Only warnings: pre-existing Sentry auth token (not our code)
```

---

## Files Created / Modified

| File | Action |
|------|--------|
| `lib/actions/task-messages.ts` | Modified — added @mention parsing + notification creation |
| `components/tasks/TaskDetailPanel.tsx` | Modified — integrated TaskMessagesPanel |
| `components/tasks/TaskMessagesPanel.tsx` | Modified — updated placeholder text |
| `docs/plans/comments-notifications-spec.md` | Created — full PRD |
| `scripts/notification-daemon.js` (workspace) | Created — Node.js polling daemon |

---

## Notes for Ziko

1. **Daemon startup**: The notification daemon needs to be started manually with `node notification-daemon.js`. Consider adding to a startup task or cron if persistent delivery is required.

2. **session_key population**: The migration already seeded `session_key` for all 24 agents. The daemon will work as soon as those agents have active OpenClaw sessions.

3. **Mention format in TaskMessagesPanel**: Users type `@AgentName` with the agent's exact display name (case-sensitive lookup). E.g., `@Omar`, `@Sara`, `@Product Analyst`.

4. **No UI changes to existing task comments**: The human-to-human comment system (TaskCommentEditor + TaskTimeline) is completely untouched. The new section is parallel, not a replacement.
