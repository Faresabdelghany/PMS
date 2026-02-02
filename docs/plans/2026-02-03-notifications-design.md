# Notifications System Design

**Date:** 2026-02-03
**Status:** Approved
**Author:** Claude + Fares

## Overview

Implement a comprehensive notification system for the project management application. The system will notify users of important events across tasks, projects, and collaboration activities via in-app notifications, push notifications, and email digests.

## Current State

The notification infrastructure is already built:

| Layer | Status |
|-------|--------|
| Database | `inbox_items` table with 5 types, RLS, indexes |
| Server Actions | Full CRUD in `lib/actions/inbox.ts` |
| UI | Complete inbox page with filtering, search, real-time |
| Real-time | Supabase subscriptions via `useInboxRealtime` |
| Preferences | Toggle for in-app and email in `user_settings` |

**What's missing:** Event triggers — nothing calls `createInboxItem()` when events occur.

## Architecture

### Approach: Inline Triggers

Add `createInboxItem()` calls directly in existing server actions. This keeps notification logic co-located with business logic and avoids over-engineering.

```
Event Occurs (task assigned, status changed, etc.)
    ↓
Server Action executes mutation
    ↓
Action calls notify() helper
    ↓
Supabase inserts row into inbox_items
    ↓
Realtime broadcasts INSERT event
    ↓
Connected clients receive update via WebSocket
    ↓
UI updates: toast shown, sidebar badge incremented
```

## Notification Events

### Task Notifications (`task_update`)

| Event | Recipients | Title Template |
|-------|------------|----------------|
| Task assigned | Assignee | `assigned you to "{task.title}"` |
| Task unassigned | Previous assignee | `removed you from "{task.title}"` |
| Task status changed | All assignees | `updated "{task.title}" status to {status}` |
| Task priority → High/Urgent | All assignees | `marked "{task.title}" as {priority}` |
| Task due in 24h | All assignees | `"{task.title}" is due tomorrow` |
| Task overdue | All assignees | `"{task.title}" is overdue` |

### Project Notifications (`project_milestone`)

| Event | Recipients | Title Template |
|-------|------------|----------------|
| Project status changed | All project members | `updated "{project.name}" to {status}` |
| Project deadline in 3 days | Owner + PIC | `"{project.name}" deadline in 3 days` |
| Deliverable completed | Owner + PIC | `marked deliverable "{name}" complete` |
| Added to project | New member | `added you to "{project.name}"` |
| Removed from project | Removed member | `removed you from "{project.name}"` |

### Collaboration Notifications (`comment`)

| Event | Recipients | Title Template |
|-------|------------|----------------|
| @mentioned | Mentioned user | `mentioned you in "{context}"` |
| Comment on assigned task | Task assignees (except commenter) | `commented on "{task.title}"` |

### Organization Notifications (`system`)

| Event | Recipients | Title Template |
|-------|------------|----------------|
| Invitation accepted | Inviter | `{name} joined {org.name}` |
| Added to organization | New member | `You've been added to {org.name}` |

## Implementation Details

### 1. Notification Helper

```typescript
// lib/actions/notifications.ts

import { createInboxItemsForUsers } from "./inbox"
import type { InboxItemType } from "@/lib/supabase/types"

interface NotifyParams {
  orgId: string
  userIds: string[]
  actorId: string
  type: InboxItemType
  title: string
  message?: string
  projectId?: string
  taskId?: string
  clientId?: string
  metadata?: Record<string, unknown>
}

export async function notify({
  orgId,
  userIds,
  actorId,
  type,
  title,
  message,
  projectId,
  taskId,
  clientId,
  metadata,
}: NotifyParams) {
  // Filter out the actor (don't notify yourself)
  const recipients = userIds.filter((id) => id !== actorId)
  if (recipients.length === 0) return

  await createInboxItemsForUsers(recipients, {
    organization_id: orgId,
    actor_id: actorId,
    item_type: type,
    title,
    message,
    project_id: projectId,
    task_id: taskId,
    client_id: clientId,
    metadata: metadata ?? {},
  })
}
```

### 2. @Mention Extraction

```typescript
// lib/actions/notifications.ts

/**
 * Extracts user IDs from @mentions in text.
 * Supports formats:
 * - @[Display Name](user-uuid)
 * - @username (future: resolve via profiles table)
 */
export function extractMentions(text: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([a-f0-9-]{36})\)/gi
  const userIds: string[] = []

  let match
  while ((match = mentionRegex.exec(text)) !== null) {
    const userId = match[2]
    if (userId && !userIds.includes(userId)) {
      userIds.push(userId)
    }
  }

  return userIds
}
```

### 3. Sidebar Badge (Fix Hardcoded Value)

```typescript
// components/app-sidebar.tsx

"use client"

import { useEffect, useState } from "react"
import { getUnreadCount } from "@/lib/actions/inbox"
import { useInboxRealtime } from "@/hooks/use-realtime"

export function AppSidebar({ userId }: { userId: string }) {
  const [unreadCount, setUnreadCount] = useState(0)

  // Fetch initial count
  useEffect(() => {
    getUnreadCount().then(({ data }) => setUnreadCount(data ?? 0))
  }, [])

  // Real-time updates
  useInboxRealtime(userId, {
    onInsert: () => setUnreadCount((prev) => prev + 1),
    onUpdate: (item, old) => {
      if (!old.is_read && item.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    },
    onDelete: (item) => {
      if (!item.is_read) {
        setUnreadCount((prev) => Math.max(0, prev - 1))
      }
    },
  })

  // ... render with unreadCount in badge
}
```

### 4. Toast on New Notification

```typescript
// components/providers/notification-toast-provider.tsx

"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useInboxRealtime } from "@/hooks/use-realtime"
import type { InboxItemWithRelations } from "@/lib/supabase/types"

interface Props {
  userId: string
  enabled: boolean // from user preferences
}

export function NotificationToastProvider({ userId, enabled }: Props) {
  const router = useRouter()

  useInboxRealtime(userId, {
    onInsert: (item: InboxItemWithRelations) => {
      if (!enabled) return

      toast(item.title, {
        description: item.message ?? undefined,
        action: item.project_id
          ? {
              label: "View",
              onClick: () => router.push(`/projects/${item.project_id}`),
            }
          : undefined,
      })
    },
  })

  return null
}
```

Add to dashboard layout:

```typescript
// app/(dashboard)/layout.tsx

<NotificationToastProvider
  userId={user.id}
  enabled={settings?.notifications_in_app ?? true}
/>
```

### 5. Scheduled Deadline Notifications

```typescript
// supabase/functions/check-deadlines/index.ts

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

interface Task {
  id: string
  title: string
  assignee_id: string
  project_id: string
  organization_id: string
  due_date: string
  metadata: Record<string, unknown>
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  )

  const now = new Date()
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  // Tasks due within 24 hours (not already notified)
  const { data: approachingTasks } = await supabase
    .from("tasks")
    .select("id, title, assignee_id, project_id, organization_id, due_date, metadata")
    .gte("due_date", now.toISOString())
    .lte("due_date", tomorrow.toISOString())
    .not("assignee_id", "is", null)
    .is("completed_at", null)
    .returns<Task[]>()

  // Filter out already notified
  const tasksToNotify = (approachingTasks ?? []).filter(
    (t) => !t.metadata?.deadline_notified
  )

  // Tasks overdue (not already notified)
  const { data: overdueTasks } = await supabase
    .from("tasks")
    .select("id, title, assignee_id, project_id, organization_id, metadata")
    .lt("due_date", now.toISOString())
    .not("assignee_id", "is", null)
    .is("completed_at", null)
    .returns<Task[]>()

  const overdueToNotify = (overdueTasks ?? []).filter(
    (t) => !t.metadata?.overdue_notified
  )

  // Create notifications for approaching deadlines
  for (const task of tasksToNotify) {
    await supabase.from("inbox_items").insert({
      organization_id: task.organization_id,
      user_id: task.assignee_id,
      actor_id: null, // system notification
      item_type: "task_update",
      title: `"${task.title}" is due tomorrow`,
      project_id: task.project_id,
      task_id: task.id,
    })

    await supabase
      .from("tasks")
      .update({ metadata: { ...task.metadata, deadline_notified: true } })
      .eq("id", task.id)
  }

  // Create notifications for overdue tasks
  for (const task of overdueToNotify) {
    await supabase.from("inbox_items").insert({
      organization_id: task.organization_id,
      user_id: task.assignee_id,
      actor_id: null,
      item_type: "task_update",
      title: `"${task.title}" is overdue`,
      project_id: task.project_id,
      task_id: task.id,
    })

    await supabase
      .from("tasks")
      .update({ metadata: { ...task.metadata, overdue_notified: true } })
      .eq("id", task.id)
  }

  return new Response(
    JSON.stringify({
      approaching: tasksToNotify.length,
      overdue: overdueToNotify.length,
    }),
    { headers: { "Content-Type": "application/json" } }
  )
})
```

**Cron setup (via Supabase Dashboard or pg_cron):**

```sql
-- Run daily at 8 AM UTC
SELECT cron.schedule(
  'check-deadlines-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lazhmdyajdqbnxxwyxun.supabase.co/functions/v1/check-deadlines',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key')
    )
  );
  $$
);
```

## Enhanced Features

### Push Notifications (Web Push API)

**New migration:**

```sql
-- supabase/migrations/XXXXXX_push_subscriptions.sql

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own subscriptions"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);
```

**Environment variables:**

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<generated-public-key>
VAPID_PRIVATE_KEY=<generated-private-key>
```

**Service worker:**

```javascript
// public/sw.js

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title ?? "New Notification"
  const options = {
    body: data.message,
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    data: { url: data.url },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(clients.openWindow(url))
})
```

### Granular Notification Preferences

**New migration:**

```sql
-- supabase/migrations/XXXXXX_notification_preferences.sql

CREATE TABLE notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notification_type inbox_item_type NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'push', 'email')),
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, notification_type, channel)
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON notification_preferences FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_notification_preferences_user_id
  ON notification_preferences(user_id);
```

**Default preferences (seeded on user creation):**

| Type | In-App | Push | Email |
|------|--------|------|-------|
| comment | true | true | true |
| task_update | true | true | false |
| client_update | true | false | false |
| project_milestone | true | true | true |
| system | true | true | true |

### Email Digests (Batched Notifications)

**Edge function: `send-notification-digest`**

Runs hourly, groups unread notifications by user, sends digest email:

```
Subject: You have 5 new notifications

- 3 task updates
- 1 mention in "Project Alpha"
- 1 project milestone

View all → [link to inbox]
```

Requires email service integration (Resend, SendGrid, or Supabase built-in).

## Files to Create

| File | Purpose |
|------|---------|
| `lib/actions/notifications.ts` | `notify()` helper, `extractMentions()` |
| `components/providers/notification-toast-provider.tsx` | Toast on new notification |
| `supabase/functions/check-deadlines/index.ts` | Scheduled deadline checks |
| `public/sw.js` | Service worker for push |
| `supabase/migrations/XXXXXX_push_subscriptions.sql` | Push subscription storage |
| `supabase/migrations/XXXXXX_notification_preferences.sql` | Granular preferences |

## Files to Modify

| File | Changes |
|------|---------|
| `lib/actions/tasks.ts` | Add notifications for assign, status, priority |
| `lib/actions/projects.ts` | Add notifications for status, member changes |
| `lib/actions/notes.ts` | Add @mention notifications |
| `lib/actions/invitations.ts` | Add invitation accepted notification |
| `lib/actions/organizations.ts` | Add member added notification |
| `components/app-sidebar.tsx` | Wire up real unread count |
| `app/(dashboard)/layout.tsx` | Add NotificationToastProvider |
| `components/settings/panes/notifications-pane.tsx` | Granular preferences UI |

## Implementation Order

### Phase 1: Core (MVP)

1. Create `notify()` helper function
2. Fix sidebar badge (remove hardcoded value)
3. Add task notifications (assign, status, priority)
4. Add project notifications (status, member changes)
5. Add toast provider for real-time feedback

### Phase 2: Collaboration

6. Add @mention extraction and notifications
7. Add comment notifications for task assignees
8. Add invitation accepted notification

### Phase 3: Scheduled

9. Deploy `check-deadlines` Edge Function
10. Set up pg_cron for daily execution
11. Add project deadline notifications (3 days)

### Phase 4: Enhanced

12. Implement push notifications (service worker + VAPID)
13. Add granular preferences table and UI
14. Implement email digest Edge Function

## Testing Strategy

1. **Unit tests:** `notify()` helper, `extractMentions()` function
2. **Integration tests:** Verify inbox items created after mutations
3. **E2E tests:**
   - Assign task → notification appears in inbox
   - Mark as read → badge decrements
   - Toast appears on new notification

## Not Included (Future)

- Mobile push notifications (requires native app)
- Slack/Discord integrations
- Notification sounds
- Quiet hours / Do Not Disturb mode
- Notification snoozing

## References

- [Supabase Push Notifications](https://supabase.com/docs/guides/functions/examples/push-notifications)
- [Next.js PWA Guide](https://nextjs.org/docs/app/guides/progressive-web-apps)
- [Web Push Protocol](https://web.dev/push-notifications-overview/)
- [Notification System Design Patterns](https://www.geeksforgeeks.org/system-design/design-notification-services-system-design/)
