# Memory Explorer — UX Concept Package

> **Task:** T7 · **Phase:** 4 · **Owner:** Designer  
> **Date:** 2026-03-01 · **Status:** Concept — ready for Dev handoff (Phase 3)  
> **Spec ref:** `specs/phase4/spec.md` §4 · **Tasks ref:** `specs/phase4/tasks.md` T7

---

## 1. Overview

Memory Explorer is a read-only interface within Mission Control that lets users inspect, search, and trace the provenance of memories stored by AI agents. It surfaces *what agents know*, *where that knowledge came from*, and *how it influenced decisions* — building trust through radical transparency.

This document is a **concept package** — no implementation. It defines Information Architecture, user flows, key components, interaction patterns, trust/citation UI, and scoped deliverables for MVP vs V1. Implementation targets Phase 3.

---

## 2. Context & Constraints

### Where it lives
Memory Explorer is a **new tab** inside the existing Mission Control tab structure:

```
Mission Control
├── Live Ops          (existing)
├── Calendar          (existing)
├── Memory Explorer   ← NEW TAB (this spec)
└── (future tabs…)
```

It is accessed via `app/(dashboard)/[org]/mission-control/` route — specifically a new sub-route or tab panel: `?tab=memory` or `/mission-control/memory`.

### Hard constraints
| Constraint | Detail |
|------------|--------|
| **Read-only in MVP** | No edit, delete, or annotation of memories |
| **Desktop-first** | Min viewport 1024px; mobile deferred to post-Phase 3 |
| **shadcn/ui + Radix primitives** | No custom component library additions beyond existing stack |
| **Fits Mission Control tabs** | Reuse `<Tabs>` pattern already present in Mission Control |
| **Design system** | OKLCH color tokens, existing spacing scale, Phosphor icons |

---

## 3. Information Architecture

### 3.1 Page Structure

```
┌─────────────────────────────────────────────────────────────────────┐
│  Mission Control   [Live Ops] [Calendar] [Memory Explorer]          │
├─────────────────────────────────────────────────────────────────────┤
│  MEMORY EXPLORER                                                     │
│  ┌─────────────────────────────────────┐  ┌───────────────────────┐│
│  │  Search + Filter Bar                │  │  Stat Summary Chips   ││
│  └─────────────────────────────────────┘  └───────────────────────┘│
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  ┌──────────────────────────┐│
│  │                                   │  │                          ││
│  │   Results List (scrollable)       │  │   Provenance Trace       ││
│  │                                   │  │   (right panel)          ││
│  │   [Memory Card]                   │  │                          ││
│  │   [Memory Card ← selected]        │  │   Shown when a memory    ││
│  │   [Memory Card]                   │  │   is selected            ││
│  │   …                               │  │                          ││
│  └───────────────────────────────────┘  └──────────────────────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 View States

| State | Trigger | Layout |
|-------|---------|--------|
| **Empty — First Run** | No memories exist for org | Full-width empty state illustration |
| **Empty — No Results** | Search returns 0 matches | List area empty state |
| **Loading** | Fetching memories | Skeleton cards in list |
| **Results — No Selection** | Memories loaded, none selected | Two-column: list + empty panel hint |
| **Results — Selected** | User clicks a memory card | Two-column: list + provenance trace |
| **Error** | Network/DB failure | Inline error with retry |

### 3.3 Navigation Hierarchy

```
/mission-control?tab=memory
│
├── Search view (default)
│   ├── Filter: Agent
│   ├── Filter: Date Range
│   └── Filter: Topic/Tag
│
├── Memory Detail → Provenance Trace
│   ├── Decision node (Level 1)
│   ├── Sub-decision node (Level 2)
│   └── Source input (Level 3+)
│
└── Empty state (first-run / zero results)
```

---

## 4. User Flows

### Flow 1 — Discovering What an Agent Knows

```
User opens Mission Control
  → Clicks "Memory Explorer" tab
  → Sees full memory list (sorted: newest first)
  → Optionally types keyword in search bar
  → Optionally applies filter chip (Agent: "Scheduler Bot")
  → Scans result cards for relevant memory
  → Clicks a card
  → Right panel opens: Provenance Trace
  → User reads the 3-level decision chain
  → User closes panel (click X or click elsewhere)
```

### Flow 2 — Investigating a Suspicious Memory

```
User notices unexpected agent behavior
  → Opens Memory Explorer
  → Searches for keyword related to behavior
  → Finds memory card with low confidence score (e.g., 42%)
  → Clicks card → Provenance Trace opens
  → Reads chain: raw input → extraction step → storage step
  → Identifies source: "Slack message from #general, 2026-02-14"
  → User understands how the memory was formed
  → (In V1: flags for review; in MVP: copies citation manually)
```

### Flow 3 — First-Run Experience

```
New org, no agents have run yet
  → User opens Memory Explorer tab
  → Sees full-page empty state
  → "No memories yet" message
  → Explanation of what memories are
  → CTA: "Set up an agent to start building memory"
  → Links to Agent Settings
```

---

## 5. Key Components

### 5.1 Search & Filter Bar

```
┌──────────────────────────────────────────────────────────────────┐
│  🔍  Search memories…                              [⌘K]          │
└──────────────────────────────────────────────────────────────────┘
  [All Agents ▾]  [Any Date ▾]  [All Topics ▾]   [Clear filters ×]
```

**Specs:**
- **Search input:** `shadcn/ui Input` with magnifying glass icon (Phosphor `MagnifyingGlass`). Placeholder: "Search memories…". Keyboard shortcut badge `⌘K` shown at right. Real-time debounced search (300ms).
- **Agent filter:** `shadcn/ui Select` or `DropdownMenu`. Multi-select checkboxes per agent. Shows agent avatar + name. Badge shows active filter count when filtered.
- **Date Range filter:** Popover with two date pickers (From / To) using `shadcn/ui Calendar` (Radix). Preset chips: "Today", "Last 7 days", "Last 30 days".
- **Topic/Tag filter:** `shadcn/ui Badge`-based multi-select. Tags are auto-extracted from memory metadata. Shown as scrollable horizontal chip list when expanded.
- **Clear filters:** Appears only when ≥1 filter active. Single click resets all.

**Keyboard nav:** Tab order: Search → Agent filter → Date filter → Topic filter → Clear. Escape clears search field.

---

### 5.2 Results List (Memory Cards)

Each memory is a card in a scrollable list (left column):

```
┌─────────────────────────────────────────────────────┐
│  [Agent Avatar]  Scheduler Bot  •  2026-02-14 09:32  │
│                                                       │
│  "The sprint planning meeting is scheduled for       │
│   Friday at 3pm. Attendees: Dev team, Product…"      │
│                                                       │
│  ─────────────────────────────────────────────────  │
│  📎 Source: Slack #general   🎯 Confidence: 87%      │
│  🏷 planning  sprint  meeting                        │
└─────────────────────────────────────────────────────┘
```

**Card anatomy:**

| Element | Component | Notes |
|---------|-----------|-------|
| **Agent avatar** | `Avatar` (shadcn/ui) with initials fallback | 28px |
| **Agent name** | `text-sm font-medium` | Truncated at 20ch |
| **Timestamp** | `text-xs text-muted-foreground` | Relative ("2 days ago") with absolute on hover tooltip |
| **Content preview** | `text-sm text-foreground` | 3 lines max, ellipsis. Full text on expand. |
| **Source citation chip** | `Badge` variant=outline | Phosphor `Paperclip` icon. Shows: source type + short label |
| **Confidence score** | Inline `Badge` with color encoding | See §6.1 |
| **Topic tags** | `Badge` variant=secondary, size=sm | Max 3 shown, "+N more" overflow |

**Selected state:** Accent left border (2px, `primary` color), `bg-primary/5` background tint.

**Hover state:** `bg-muted/50`, cursor pointer. Card lifts with `shadow-sm` transition.

**Loading skeleton:** 3 placeholder cards with `animate-pulse` bars mimicking card structure.

---

### 5.3 Provenance Trace View (Right Panel)

The right panel opens when a memory card is selected. It renders the decision chain that led to this memory being stored or used.

```
┌──────────────────────────────────────────────────┐
│  Provenance Trace                          [×]   │
│  Memory: "Sprint planning meeting…"              │
│  ─────────────────────────────────────────────  │
│                                                  │
│  ● STORED  —  2026-02-14 09:32                   │
│  │  Memory saved to agent knowledge base         │
│  │  Agent: Scheduler Bot                        │
│  │                                               │
│  ● EXTRACTED  —  09:31                           │
│  │  Extracted from message via NLP pipeline      │
│  │  Confidence delta: 91% → 87%                 │
│  │  Model: gpt-4o (extraction)                  │
│  │                                               │
│  ● RECEIVED  —  09:30                            │
│  │  Raw input: Slack message                     │
│  │  Channel: #general                           │
│  │  Author: @fares                              │
│  │  Message ID: slack://msg/C01234              │
│  │                                               │
│  ● TRIGGERED BY  —  09:29                        │
│     Scheduled scan: "Daily Slack digest"         │
│     Run ID: run_abc123                           │
│                                                  │
│  ─────────────────────────────────────────────  │
│  [Copy Citation]  [View Raw JSON]               │
└──────────────────────────────────────────────────┘
```

**Trace node types:**

| Node Type | Icon (Phosphor) | Color |
|-----------|----------------|-------|
| `STORED` | `Database` | `text-primary` |
| `EXTRACTED` | `Funnel` | `text-amber-600` |
| `RECEIVED` | `ArrowDown` | `text-muted-foreground` |
| `TRIGGERED_BY` | `Timer` | `text-muted-foreground` |
| `USED_IN_DECISION` | `Brain` | `text-violet-600` |
| `CONFLICT` | `Warning` | `text-destructive` |

**Vertical connector line:** `border-l-2 border-muted ml-[7px]` with node dots `w-3.5 h-3.5 rounded-full border-2 bg-background`.

**Node expansion:** Each node is collapsed by default showing 1-line summary. Click to expand full metadata. Uses `<Collapsible>` (Radix).

**Minimum depth:** 3 levels always shown (STORED → EXTRACTED → RECEIVED). Additional levels (TRIGGERED_BY, USED_IN_DECISION) shown when data exists.

**Actions at panel bottom:**
- **Copy Citation** — copies formatted citation string to clipboard (Phosphor `Copy` icon)
- **View Raw JSON** — opens a `<Dialog>` with syntax-highlighted JSON of the full memory object (use `<pre>` with `text-xs font-mono`)

**Panel sizing:** Fixed width 380px on ≥1280px viewports. At 1024–1279px, panel overlays as a slide-in drawer from right (Radix `Sheet`).

---

### 5.4 Empty States

#### 5.4.1 First-Run Empty State (No memories exist)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│              [Brain icon — 48px, text-muted-foreground]          │
│                                                                  │
│              No memories yet                                     │
│              (text-xl font-semibold)                             │
│                                                                  │
│    Your agents will store memories as they run tasks.            │
│    Memories help agents learn from context and make              │
│    better decisions over time.                                   │
│    (text-sm text-muted-foreground, max-w-sm centered)            │
│                                                                  │
│              [Set up an Agent →]                                 │
│              (Button variant=default, links to /settings/agents) │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### 5.4.2 No Search Results Empty State

```
┌────────────────────────────────────────────┐
│                                            │
│   [MagnifyingGlass icon — 36px, muted]     │
│                                            │
│   No memories match your search            │
│   (text-base font-medium)                  │
│                                            │
│   Try different keywords or clear filters  │
│   (text-sm text-muted-foreground)          │
│                                            │
│   [Clear filters]                          │
│   (Button variant=outline, size=sm)        │
│                                            │
└────────────────────────────────────────────┘
```

#### 5.4.3 Right Panel — Nothing Selected

```
┌────────────────────────────────────────────┐
│                                            │
│   [ArrowLeft icon — 32px, muted]           │
│                                            │
│   Select a memory to trace its provenance  │
│   (text-sm text-muted-foreground centered) │
│                                            │
└────────────────────────────────────────────┘
```

---

## 6. Trust & Citation UI

### 6.1 Confidence Score Display

Confidence scores (0–100%) are surfaced on every memory card and in the provenance trace. Visual encoding:

| Score Range | Badge Color | Label |
|-------------|------------|-------|
| 80–100% | `bg-green-100 text-green-700` (dark: `bg-green-900/30 text-green-400`) | High confidence |
| 50–79% | `bg-amber-100 text-amber-700` | Medium confidence |
| 20–49% | `bg-orange-100 text-orange-700` | Low confidence |
| 0–19% | `bg-red-100 text-red-700` | Very low confidence |

Score is shown as: `🎯 87%` on cards. In provenance trace: full label "Confidence: 87% (High)".

### 6.2 Source Citation Chip

Every memory card shows a source citation chip:

```
📎  Slack #general
```

Source types and their icons (Phosphor):

| Source Type | Icon | Example label |
|-------------|------|---------------|
| Slack | `ChatCircle` | "Slack #general" |
| Email | `Envelope` | "Email: sprint-recap@…" |
| Document | `FileText` | "Doc: Q1 Plan.pdf" |
| Task | `CheckSquare` | "Task: #342 Deploy fix" |
| Web | `Globe` | "Web: notion.so/…" |
| Manual | `PencilSimple` | "Manual entry" |
| Unknown | `Question` | "Unknown source" |

Citation chip is `Badge` variant=outline with icon. Clicking expands to show full source URL/ID in a tooltip (`Tooltip` Radix primitive).

### 6.3 Conflict & Warning Indicators

When provenance trace contains a `CONFLICT` node (memory was overwritten or contradicted):

- Card header shows a `Warning` icon (Phosphor, amber) with tooltip: "This memory has a conflict in its provenance"
- Conflict node in trace is highlighted with `bg-destructive/10 border-destructive` styling
- Conflict reason shown in node expand: "Superseded by newer memory on 2026-02-16"

### 6.4 Decision Usage Indicator

When a memory has been used in an agent decision (USED_IN_DECISION node exists):

- Card shows a `Brain` badge (Phosphor, violet): "Used in 3 decisions"
- Clicking badge scrolls to USED_IN_DECISION nodes in provenance trace

---

## 7. Interaction Patterns

### 7.1 Keyboard Navigation

| Key | Action |
|-----|--------|
| `⌘K` / `Ctrl+K` | Focus search input |
| `↑` / `↓` | Navigate memory cards |
| `Enter` / `Space` | Open provenance trace for focused card |
| `Escape` | Close provenance panel; if open, else clear search |
| `Tab` | Move through filter controls |
| `F` | (In panel) Focus "Copy Citation" button |

### 7.2 Loading States

- **Initial load:** Skeleton cards (3 visible) with `animate-pulse`. Search/filter bar shown but disabled.
- **Search debounce:** 300ms after last keystroke. Spinner replaces search icon during fetch.
- **Provenance panel load:** Panel shows skeleton trace (3 nodes with pulse) while fetching.
- **Filter change:** List fades to 40% opacity + spinner overlay while results update.

### 7.3 Scroll Behavior

- Results list is independently scrollable (not the whole page)
- Right panel is independently scrollable
- Selecting a card: panel scrolls to top; card scrolls into view if off-screen
- Infinite scroll (V1) or pagination "Load more" button (MVP) at list bottom

### 7.4 URL State Persistence

- Active filters reflected in URL query params: `?tab=memory&agent=abc&q=sprint`
- Selected memory ID in URL: `&memory=mem_xyz` — enables link-sharing of specific memory + trace
- Browser back/forward navigates filter state

### 7.5 Accessibility

- All interactive elements have `aria-label`
- Provenance trace is a `<ol>` with `role="list"`, each node `role="listitem"`
- Confidence score badges have `aria-label="Confidence score: 87 percent, High"`
- Panel has `role="complementary"` and `aria-label="Provenance trace"`
- Focus trapped in panel when open (Radix `FocusTrap`)
- Color is never the only differentiator (icons accompany all color-coded elements)

---

## 8. MVP vs V1 Scope

### MVP (Phase 3 Initial Ship)

| Feature | Included | Notes |
|---------|----------|-------|
| Search bar (full-text) | ✅ | Debounced, real-time |
| Agent filter | ✅ | Single-select in MVP |
| Date range filter | ✅ | Preset chips only |
| Topic/tag filter | ❌ | Deferred — tags may not exist in DB yet |
| Memory card list | ✅ | Confidence, source, timestamp, preview |
| Pagination (Load more) | ✅ | Simple offset-based |
| Provenance trace panel | ✅ | 3 fixed levels (STORED→EXTRACTED→RECEIVED) |
| Dynamic trace levels | ❌ | TRIGGERED_BY, USED_IN_DECISION deferred |
| Node expansion (collapsible) | ✅ | Each node expandable |
| Copy Citation button | ✅ | Plain text format |
| View Raw JSON | ✅ | Dialog with pre-formatted JSON |
| Empty states (all 3) | ✅ | First-run, no results, no selection |
| Conflict indicators | ❌ | Deferred to V1 |
| URL state persistence | ✅ | tab, agent, q params |
| Memory ID in URL | ❌ | V1 |
| Keyboard shortcut ⌘K | ✅ | Focus search |
| Card keyboard nav (↑↓) | ✅ | |
| Mobile / responsive | ❌ | Desktop-only |
| Panel as Sheet (1024–1279px) | ✅ | Required for desktop constraint |

### V1 (Phase 3 Iteration or Phase 4)

| Feature | Notes |
|---------|-------|
| Topic/tag filter | Requires tag metadata in memory schema |
| Agent filter multi-select | |
| Date range custom picker | Full calendar date pickers |
| Dynamic provenance levels | TRIGGERED_BY, USED_IN_DECISION nodes |
| Conflict + warning indicators | Requires conflict tracking in memory DB |
| Decision usage indicator | "Used in N decisions" badge + links |
| Memory ID URL sharing | Deep link to specific memory + trace |
| Infinite scroll | Replace "Load more" pagination |
| Annotation / flagging | Add user notes (breaks read-only constraint) |
| Export memories | CSV/JSON export |
| Mobile responsive | Sheet-based layout for mobile |

---

## 9. Component Map (Dev Reference)

### shadcn/ui + Radix Components Used

| Component | Usage |
|-----------|-------|
| `Tabs` | Mission Control tab structure |
| `Input` | Search bar |
| `Select` | Agent filter |
| `DropdownMenu` | Filter dropdowns |
| `Badge` | Confidence scores, source chips, topic tags |
| `Card` | Memory cards in results list |
| `Separator` | Dividers in cards and panel |
| `Avatar` | Agent avatars |
| `Tooltip` | Timestamps, source details, confidence label |
| `Sheet` | Right panel at narrow desktop (1024–1279px) |
| `Dialog` | Raw JSON viewer |
| `Collapsible` | Provenance trace node expansion |
| `Skeleton` | Loading states |
| `Button` | Copy Citation, View Raw JSON, Clear filters, Load more |
| `ScrollArea` | Results list + provenance panel scroll |

### Phosphor Icons Used

| Icon | Usage |
|------|-------|
| `MagnifyingGlass` | Search bar |
| `Brain` | Memory Explorer tab icon; STORED node |
| `Funnel` | EXTRACTED node |
| `ArrowDown` | RECEIVED node |
| `Timer` | TRIGGERED_BY node |
| `Warning` | Conflict indicator |
| `Paperclip` | Source citation |
| `Copy` | Copy Citation button |
| `X` | Close panel; clear filters |
| `ArrowLeft` | Empty panel state |
| `CaretDown` | Filter dropdowns |
| `Database` | STORED node alternative |
| `ChatCircle` | Slack source |
| `Envelope` | Email source |
| `FileText` | Document source |
| `CheckSquare` | Task source |
| `Globe` | Web source |

---

## 10. Layout Specifications

### Desktop (≥1280px) — Two-column

```
Total width: 100%
Left column (Results List):  flex-1 min-w-0  (takes remaining space)
Right column (Panel):        width: 380px   (fixed)
Gap between columns:         gap-4 (16px)
Column height:               calc(100vh - [header + tabs height])
                             Both columns use overflow-y: auto
```

### Desktop Narrow (1024–1279px) — Single column + Sheet

```
Results List:    100% width
Provenance:      Sheet from right, width: 380px, overlays list
Sheet overlay:   bg-background/80 backdrop-blur-sm
```

### Search + Filter Bar

```
Height:          40px (Input height-10)
Filter chips:    Row below search bar, height: 32px
Gap:             gap-2 between chips
Padding:         p-4 bottom (space between bar and list)
```

### Memory Cards

```
Padding:         p-4
Gap between:     gap-2 (8px) in list
Border:          border border-border rounded-lg
Selected:        border-primary border-l-4
Min height:      96px
Max content:     3 lines of preview text
```

### Provenance Trace Panel

```
Padding:         p-4
Header height:   48px (title + close button)
Node vertical:   gap-0 (nodes connected by line)
Node padding:    py-3 pl-6 pr-2
Connector line:  absolute left-[19px] top-0 bottom-0 w-0.5 bg-border
Node dot:        absolute left-[13px] w-3 h-3 rounded-full border-2
Actions footer:  border-t pt-3 flex gap-2 sticky bottom-0 bg-card
```

---

## 11. Acceptance Criteria (Implementation Handoff)

### AC-1: Search View
- [ ] Search bar is visible and functional on Memory Explorer tab load
- [ ] Typing in search bar filters results in ≤300ms (debounced)
- [ ] Agent filter shows all agents that have stored memories for the org
- [ ] Date range filter presets ("Today", "Last 7 days", "Last 30 days") work correctly
- [ ] "Clear filters" button appears when ≥1 filter is active and resets all on click
- [ ] ⌘K / Ctrl+K focuses the search bar from anywhere in the tab

### AC-2: Results List
- [ ] Memory cards display: agent avatar, agent name, timestamp, content preview (3 lines max), source citation chip, confidence score badge, topic tags (max 3 + overflow)
- [ ] Cards are sorted newest-first by default
- [ ] Confidence score badge uses correct color encoding per §6.1
- [ ] Source citation chip shows correct icon per source type per §6.2
- [ ] Timestamp shows relative time with absolute time on hover tooltip
- [ ] Skeleton loading state shown while data fetches
- [ ] "Load more" button at list bottom for pagination
- [ ] ↑/↓ keyboard navigation moves focus between cards

### AC-3: Provenance Trace
- [ ] Clicking a memory card opens the provenance panel
- [ ] Panel shows minimum 3 levels: STORED → EXTRACTED → RECEIVED
- [ ] Each node is collapsible (collapsed by default, expanded on click)
- [ ] Each node shows: type label, timestamp, 1-line summary (collapsed), full metadata (expanded)
- [ ] "Copy Citation" button copies formatted citation to clipboard with visual confirmation (toast or icon change)
- [ ] "View Raw JSON" button opens Dialog with full memory JSON
- [ ] Panel renders as fixed right column at ≥1280px; as Sheet overlay at 1024–1279px
- [ ] Escape key closes provenance panel
- [ ] Panel is independently scrollable

### AC-4: Empty States
- [ ] First-run empty state shown when org has zero memories (full-page, centered)
- [ ] No-results empty state shown in list area when search/filter returns zero results
- [ ] "Nothing selected" state shown in right panel when no card is selected
- [ ] First-run CTA ("Set up an Agent") links to `/settings/agents`
- [ ] "Clear filters" button in no-results state resets all active filters

### AC-5: General
- [ ] Memory Explorer renders correctly at 1024px, 1280px, and 1440px widths
- [ ] No horizontal scroll at any supported width
- [ ] All interactive elements are keyboard accessible
- [ ] All icons have accompanying text or aria-label (color not sole differentiator)
- [ ] URL reflects active filters and search query (tab, agent, q params)
- [ ] Page does not re-fetch on tab switch if data was loaded in last 60s (stale-while-revalidate)

---

## 12. Open Questions (for Product/Dev to Resolve Pre-Phase 3)

| # | Question | Impact |
|---|----------|--------|
| Q1 | What is the memory schema? Does a `confidence` field exist, or must it be derived? | Confidence score display |
| Q2 | Does the provenance chain exist as structured data in the DB, or must it be reconstructed from logs? | Entire trace view |
| Q3 | Are topic/tag fields populated in the memory schema? | Tag filter MVP vs V1 |
| Q4 | How many memories per org should we expect? (Impacts pagination strategy) | Infinite scroll vs. pagination |
| Q5 | Should the Memory Explorer tab be visible to all org members, or only admins? | Access control |
| Q6 | Is there a `source_url` or `source_id` field on memories for citation construction? | Citation chip |

---

## 13. Design Deliverable Checklist

| Deliverable | Status |
|-------------|--------|
| Information Architecture | ✅ §3 |
| User Flows | ✅ §4 |
| Component specs (Search + Filter) | ✅ §5.1 |
| Component specs (Memory Cards) | ✅ §5.2 |
| Component specs (Provenance Trace) | ✅ §5.3 |
| Component specs (Empty States) | ✅ §5.4 |
| Trust / Citation UI | ✅ §6 |
| Interaction Patterns | ✅ §7 |
| MVP vs V1 scope | ✅ §8 |
| Component map for Dev | ✅ §9 |
| Layout specifications | ✅ §10 |
| Acceptance criteria | ✅ §11 |
| Open questions | ✅ §12 |

---

*This document supersedes any informal sketch notes. Wire-fidelity is ASCII/spec-level — no Figma file required for this handoff. Dev may proceed to implementation from this document in Phase 3.*
