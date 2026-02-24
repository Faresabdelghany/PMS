# PRD: Task Comments UI + @Mention Parsing + Notification Daemon

**Date:** 2026-02-24  
**Author:** Product Analyst  
**Assignee:** Omar (Tech Lead)  
**Parity target:** MissionControlHQ.ai

---

## Overview

Three interlinked features that complete PMS Mission Control's agent communication layer:

1. **Task Agent Messages UI** — Surface the `task_messages` thread inside `TaskDetailPanel`.
2. **@mention parsing** — Parse `@AgentName` in submitted messages and fan-out `agent_notifications` rows.
3. **Notification daemon** — Node.js polling script that delivers unread notifications to agent sessions.

---

## Feature 1: Task Agent Messages UI

### Goal
Extend `components/tasks/TaskDetailPanel.tsx` to render a **"Agent Messages"** section below the existing activity timeline. Use the already-built `TaskMessagesPanel` component; do NOT rebuild it.

### Current State
- `components/tasks/TaskMessagesPanel.tsx` — component exists, fully functional.
- `lib/actions/task-messages.ts` — `getMessages()` + `createMessage()` already exist.
- `TaskDetailPanel.tsx` — does NOT currently import or render `TaskMessagesPanel`.

### What to Build

**In `TaskDetailPanel.tsx`:**
1. Determine the logged-in user's ID. The panel already receives `organizationMembers`; use `organizationMembers[0]?.profile?.id` as a fallback, but **better**: call `requireAuth` in a server component or pass `userId` as a prop from the parent.
   - **Implementation choice**: Add a `userId: string` prop to `TaskDetailPanelProps` and thread it down from all call sites.
2. Import and render `TaskMessagesPanel` **below the `<div className="h-px w-full bg-border/80" />`** separator and **above** the existing activity/comment section. Add a second separator below it.
3. Pass `taskId`, `orgId={organizationId}`, `userId` to `TaskMessagesPanel`.

**Call sites to update (add `userId` prop):**
- `components/tasks/TaskDetail.tsx` — look for where `TaskDetailPanel` is rendered and pass `userId`.
- Any page that renders `TaskDetailPanel` (grep `<TaskDetailPanel`).

**UI spec:**
- The existing `TaskMessagesPanel` already uses correct design tokens; no UI redesign needed.
- Section header: "Agent Messages" with `MessageSquare` icon (already in the component).
- Empty state already handled inside the component.

---

## Feature 2: @mention Parsing

### Goal
When `createMessage()` is called in `lib/actions/task-messages.ts`, after inserting the message, parse `@AgentName` patterns from the content, look up matching agents, and insert `agent_notifications` rows.

### Schema Reference

**`task_messages`:**
```
id, organization_id, task_id, from_agent_id, from_user_id, content, created_at
```

**`agent_notifications`:**
```
id, organization_id, mentioned_agent_id, task_id, message_id, content, delivered, created_at
```
> ⚠️ IMPORTANT: The column is `mentioned_agent_id`, NOT `agent_id`. Use exactly this name.

**`agents`:**
```
id, name, session_key, organization_id, ...
```

### Implementation in `lib/actions/task-messages.ts`

Add a helper function `parseMentions(content: string): string[]` that:
1. Uses regex `/\@([A-Za-z][A-Za-z0-9 _-]{0,49})/g` to extract all mention names.
2. Returns deduplicated list of mention strings (e.g. `["Omar", "Sara"]`).

After successful `createMessage` insert, call the new `handleMentions` helper:

```typescript
async function handleMentions(
  supabase: SupabaseClient,
  orgId: string,
  taskId: string,
  messageId: string,
  content: string
): Promise<void> {
  const mentions = parseMentions(content)
  if (mentions.length === 0) return

  // Look up agents by name in the org
  const { data: agents } = await (supabase as any)
    .from("agents")
    .select("id, name")
    .eq("organization_id", orgId)
    .in("name", mentions)

  if (!agents || agents.length === 0) return

  const notifications = agents.map((agent: { id: string; name: string }) => ({
    organization_id: orgId,
    mentioned_agent_id: agent.id,
    task_id: taskId,
    message_id: messageId,
    content: `You were mentioned in a task message: "${content.slice(0, 200)}"`,
    delivered: false,
  }))

  await (supabase as any)
    .from("agent_notifications")
    .insert(notifications)
}
```

Call `handleMentions` inside `createMessage()` after the insert succeeds:
```typescript
// After: return { data: data as unknown as TaskMessage }
// Before the return, call:
await handleMentions(supabase, orgId, taskId, data.id, content)
```

> Note: `handleMentions` should NOT throw — wrap in try/catch and log any error without failing the parent action.

### Mention input hint in UI
Update `TaskMessagesPanel.tsx` placeholder text from `"Add a comment..."` to `"Add a comment... Use @AgentName to notify"`.

---

## Feature 3: Notification Daemon

### Goal
A standalone Node.js script at:
```
C:\Users\Fares\.openclaw\workspace\scripts\notification-daemon.js
```
That polls `agent_notifications` every 2 seconds, delivers unread notifications to their agent sessions via the OpenClaw CLI, and marks them delivered.

### Implementation

```javascript
// notification-daemon.js
// Polls agent_notifications every 2s, delivers via openclaw CLI

const { execSync } = require("child_process")

const SUPABASE_URL = "https://lazhmdyajdqbnxxwyxun.supabase.co"
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhemhtZHlhamRxYm54eHd5eHVuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTAzMzUzMCwiZXhwIjoyMDg0NjA5NTMwfQ.ynuJxkd-n6t162KfbHsaR-OVPBG-Ap65T_-VfCqN4ao"
const POLL_INTERVAL_MS = 2000

async function fetchUndelivered() {
  const url = `${SUPABASE_URL}/rest/v1/agent_notifications?delivered=eq.false&select=id,content,mentioned_agent_id`
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase fetch failed: ${res.status}`)
  return await res.json()
}

async function fetchAgentSessionKey(agentId) {
  const url = `${SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}&select=session_key`
  const res = await fetch(url, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`Agent fetch failed: ${res.status}`)
  const rows = await res.json()
  return rows[0]?.session_key ?? null
}

async function markDelivered(notificationId) {
  const url = `${SUPABASE_URL}/rest/v1/agent_notifications?id=eq.${notificationId}`
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ delivered: true }),
  })
  if (!res.ok) throw new Error(`Mark delivered failed: ${res.status}`)
}

function sendToSession(sessionKey, content) {
  // Sanitize content for shell safety
  const safeContent = content.replace(/'/g, "\\'").replace(/"/g, '\\"')
  const cmd = `openclaw sessions send --session "${sessionKey}" --message "${safeContent}"`
  execSync(cmd, { stdio: "inherit" })
}

async function poll() {
  try {
    const notifications = await fetchUndelivered()
    if (!Array.isArray(notifications) || notifications.length === 0) return

    for (const notif of notifications) {
      try {
        const sessionKey = await fetchAgentSessionKey(notif.mentioned_agent_id)
        if (!sessionKey) {
          console.log(`[daemon] No session_key for agent ${notif.mentioned_agent_id}, skipping`)
          await markDelivered(notif.id) // mark delivered to avoid retry loop
          continue
        }

        sendToSession(sessionKey, notif.content)
        await markDelivered(notif.id)
        console.log(`[daemon] Delivered notification ${notif.id} to ${sessionKey}`)
      } catch (err) {
        console.error(`[daemon] Failed to deliver notification ${notif.id}:`, err.message)
      }
    }
  } catch (err) {
    console.error("[daemon] Poll error:", err.message)
  }
}

console.log("[daemon] Notification daemon started. Polling every 2s...")
setInterval(poll, POLL_INTERVAL_MS)
poll() // run immediately on start
```

### Usage
```bash
node C:\Users\Fares\.openclaw\workspace\scripts\notification-daemon.js
```

The daemon should be started on machine boot or manually when working. It runs indefinitely.

---

## Acceptance Criteria

### Feature 1 (Comments UI)
- [ ] `TaskDetailPanel` renders `TaskMessagesPanel` between description and activity sections
- [ ] Messages load on panel open for any task
- [ ] New messages submit and appear in the list
- [ ] `userId` prop threaded correctly through all call sites
- [ ] 0 TypeScript errors

### Feature 2 (@mentions)
- [ ] Submitting a message with `@Omar` creates an `agent_notifications` row for Omar
- [ ] Submitting with `@Nonexistent` creates no notification (graceful)
- [ ] Multiple `@mentions` in one message create multiple notifications
- [ ] Mention content is truncated to 200 chars
- [ ] `createMessage` still returns normally even if mention processing fails

### Feature 3 (Daemon)
- [ ] Script exists at `scripts/notification-daemon.js`
- [ ] `node scripts/notification-daemon.js` starts without error
- [ ] Undelivered rows are fetched, session_key looked up, `openclaw sessions send` called
- [ ] Row is marked `delivered: true` after successful send
- [ ] Rows with no `session_key` are marked delivered (skipped gracefully)

---

## Build Verification
Run from `C:\Users\Fares\Downloads\PMS`:
```
pnpm.cmd build
```
0 TypeScript errors required before sign-off.

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/actions/task-messages.ts` | Modify — add `parseMentions` + `handleMentions` called inside `createMessage` |
| `components/tasks/TaskDetailPanel.tsx` | Modify — add `userId` prop, import and render `TaskMessagesPanel` |
| `components/tasks/TaskMessagesPanel.tsx` | Modify — update placeholder text |
| Call sites of `TaskDetailPanel` | Modify — pass `userId` prop |
| `C:\Users\Fares\.openclaw\workspace\scripts\notification-daemon.js` | Create — notification daemon |

---

## Tech Notes

- Use `(supabase as any)` for new tables not in generated types (as per CLAUDE.md pattern)
- No new RLS policies needed — tables already have them from the migration
- No new migrations needed — all tables exist
- Do NOT use TanStack Query — use server actions pattern
- Daemon uses raw `fetch` against Supabase REST API (no Supabase client needed in Node.js script)
- `openclaw sessions send` is the CLI command (verify exact syntax with `openclaw sessions --help` if needed)
