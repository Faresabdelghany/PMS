# Bug Report: Agent Activities Missing in Agent Details Panel

**Task ID:** 329bb5e6-b13e-4157-81c1-dc2234c0ce5d  
**Date:** 2026-02-27  
**Severity:** Medium  

## Summary

The agent details panel on the `/agents` page has two separate overlay components for viewing agent details. Only one of them (`AgentQuickView`, triggered via `?view=<id>`) fetches and displays agent activities. The other (`AgentDetailPanel`, triggered via `?agent=<id>`) — which is the primary create/edit modal — **completely omits the activity feed**.

This means users opening an agent through the main edit flow see zero activity history, giving the false impression that agents have no activity.

## Affected Components

| File | Component | Activities? |
|---|---|---|
| `components/agents/agent-detail-panel.tsx` | `AgentQuickView` | ✅ Fetches via `getAgentActivities`, renders `AgentActivityFeed` |
| `components/agents/AgentDetailPanel.tsx` | `AgentDetailPanel` | ❌ No fetch, no render |
| `app/(dashboard)/agents/[agentId]/page.tsx` | `AgentDetail` (full page) | ✅ Fetches activities, but uses inline renderer instead of `AgentActivityFeed` |

## Root Cause

`AgentDetailPanel.tsx` was built as a create/edit form and never had the activity feed wired in. The `getAgentActivities` call and `AgentActivityFeed` component exist and work — they're just not imported or used in this component.

## Secondary Issue

The full-page agent detail view (`/agents/[agentId]`) duplicates activity rendering logic inline rather than reusing the `AgentActivityFeed` component, leading to inconsistent styling (no timeline icons, no relative time formatting).

## Impact

- Users see "no activity" when viewing agents through the `?agent=` flow
- Inconsistent UX between three views of the same agent data
