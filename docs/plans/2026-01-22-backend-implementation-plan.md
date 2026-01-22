# Implementation Plan: PMS Backend

**Date**: 2026-01-22
**PRD Reference**: `docs/plans/2026-01-22-backend-prd.md`
**Estimated Tasks**: 47

---

## Phase 1: Foundation (Setup & Auth) - COMPLETED

### 1.1 Repository & Tooling Setup - COMPLETED

- [x] **1.1.1** Initialize git repository
- [x] **1.1.2** Install Vercel CLI and link project
- [x] **1.1.3** Install Supabase CLI and link project
- [x] **1.1.4** Create `.env.local` with Supabase credentials
- [x] **1.1.5** Add `.env.local` to `.gitignore`
- [x] **1.1.6** Initial commit and push to GitHub

### 1.2 Database Migration - COMPLETED

- [x] **1.2.1** Create migration file: `supabase/migrations/20260122000001_initial_schema.sql`
  - All enums (12 types)
  - All tables (17 tables)
  - All indexes
  - Profile sync trigger from auth.users
  - Updated_at triggers

- [x] **1.2.2** Create RLS policies file: `supabase/migrations/20260122000002_rls_policies.sql`
  - Helper functions (is_org_member, is_org_admin, is_project_member, is_project_owner, get_project_org_id)
  - Policies for all tables

- [x] **1.2.3** Create storage buckets file: `supabase/migrations/20260122000003_storage.sql`
  - Buckets: project-files (50MB), project-images (10MB), project-media (100MB), avatars (2MB), org-logos (5MB)
  - Storage helper functions in public schema
  - Storage policies for all buckets

- [x] **1.2.4** Run migrations - All applied successfully

### 1.3 Supabase Client Setup - COMPLETED

- [x] **1.3.1** Create `lib/supabase/client.ts` - Browser client
- [x] **1.3.2** Create `lib/supabase/server.ts` - Server client with cookies
- [x] **1.3.3** Create `lib/supabase/admin.ts` - Service role client
- [x] **1.3.4** Create `lib/supabase/types.ts` - Database types with helper exports

### 1.4 Authentication - COMPLETED

- [x] **1.4.1** Create `lib/actions/auth.ts`
  - `signUp(formData)` - Email/password signup with email confirmation
  - `signIn(formData)` - Email/password login
  - `signInWithGoogle()` - Google OAuth
  - `signOut()` - Logout
  - `resetPassword(formData)` - Password reset email
  - `updatePassword(formData)` - Update password after reset
  - `getUser()` - Get current user
  - `getUserWithProfile()` - Get user with profile data
  - `updateProfile(formData)` - Update user profile

- [x] **1.4.2** Create `app/(auth)/layout.tsx` - Auth layout (centered, no sidebar)

- [x] **1.4.3** Create `app/(auth)/login/page.tsx`
  - Email/password form with Zod validation
  - Google OAuth button
  - Link to signup
  - Link to forgot password
  - Inline error messages on blur
  - Submit button disabled until form is valid

- [x] **1.4.4** Create `app/(auth)/signup/page.tsx`
  - Email/password/name form with Zod validation
  - Google OAuth button
  - Link to login
  - Success state with email confirmation message
  - Inline error messages on blur
  - Submit button disabled until form is valid

- [x] **1.4.5** Create `app/auth/callback/route.ts` - OAuth callback handler
  - Exchanges code for session
  - Checks if user has organization
  - Redirects to onboarding if no org

- [x] **1.4.6** Create `app/(auth)/forgot-password/page.tsx`
  - Email input form
  - Calls resetPassword server action
  - Success state with "Check your email" message
  - Back to sign in link

- [x] **1.4.7** Create `components/ui/form.tsx` - shadcn/ui Form component
  - React Hook Form integration
  - FormField, FormItem, FormLabel, FormControl, FormMessage components

- [x] **1.4.8** Create `middleware.ts` - Route protection
  - Protects all routes except auth pages and public pages
  - Redirects unauthenticated users to `/login`
  - Redirects authenticated users from auth pages to `/`
  - Checks for organization membership, redirects to `/onboarding` if none

### 1.5 Organization First-Login Flow - COMPLETED

- [x] **1.5.1** Create `app/onboarding/page.tsx`
  - Organization name input
  - Creates organization and adds user as admin
  - Redirects to dashboard

- [x] **1.5.2** Create `lib/actions/organizations.ts`
  - `createOrganization(formData)` - Creates org with auto-generated slug
  - `getOrganization(id)` - Get single org
  - `getUserOrganizations()` - Get user's orgs
  - `updateOrganization(id, formData)` - Update org
  - `deleteOrganization(id)` - Delete org
  - `getOrganizationMembers(orgId)` - Get members with profiles
  - `updateMemberRole(orgId, userId, role)` - Change member role
  - `removeMember(orgId, userId)` - Remove member

---

## Phase 2: Core Data Layer - COMPLETED

### 2.1 Organization Management - COMPLETED

- [x] **2.1.1** Create `lib/actions/teams.ts`
  - `createTeam(orgId, name, description)`
  - `updateTeam(id, data)`
  - `deleteTeam(id)`
  - `getTeams(orgId)`

- [x] **2.1.2** Create `lib/actions/invitations.ts`
  - `inviteMember(orgId, email, role)`
  - `acceptInvitation(token)`
  - `cancelInvitation(id)`
  - `getPendingInvitations(orgId)`

- [x] **2.1.3** Create `app/invite/[token]/page.tsx` - Invitation acceptance page

- [x] **2.1.4** Create `app/(dashboard)/settings/organization/page.tsx`
  - Org name, logo, slug
  - Members list with roles
  - Invite new member form
  - Danger zone: delete org

- [x] **2.1.5** Create `hooks/use-organization.ts` - Organization context hook

- [x] **2.1.6** Create `components/providers/organization-provider.tsx`

### 2.2 Client Management - COMPLETED

- [x] **2.2.1** Create `lib/actions/clients.ts`
  - `createClient(data)`
  - `updateClient(id, data)`
  - `deleteClient(id)`
  - `getClient(id)`
  - `getClients(orgId, filters)`

- [x] **2.2.2** Update `components/clients-content.tsx`
  - Replace mock data with `getClients()` call
  - Server-side data fetching in page.tsx
  - Uses `getClientsWithProjectCounts()` for project count display

- [x] **2.2.3** Update `components/clients/ClientDetailsPage.tsx`
  - Fetch client with `getClient()` and related projects
  - Server-side data fetching in page.tsx

- [x] **2.2.4** Update `components/clients/ClientWizard.tsx`
  - Call `createClientAction()` or `updateClient()` on submit
  - Real-time UI updates with router.refresh()

### 2.3 Project Management - COMPLETED

- [x] **2.3.1** Create `lib/actions/projects.ts`
  - `createProject(data)`
  - `updateProject(id, data)`
  - `deleteProject(id)`
  - `getProject(id)`
  - `getProjects(orgId, filters)`
  - `addProjectMember(projectId, userId, role)`
  - `removeProjectMember(projectId, userId)`

- [x] **2.3.2** Create `lib/actions/project-details.ts`
  - `getProjectScope(projectId)`
  - `updateProjectScope(projectId, inScope[], outOfScope[])`
  - `getProjectOutcomes(projectId)`
  - `updateProjectOutcomes(projectId, outcomes[])`
  - `getProjectFeatures(projectId)`
  - `updateProjectFeatures(projectId, features[])`

- [x] **2.3.3** Update `components/projects-content.tsx`
  - Replace mock `projects` import with `getProjects()` call
  - Server-side data fetching in page.tsx
  - Converted view to use real Supabase data

- [x] **2.3.4** Update `components/project-wizard/ProjectWizard.tsx`
  - Call `createProject()` on submit
  - StepQuickCreate calls real createProject server action

- [x] **2.3.5** Update `components/projects/ProjectDetailsPage.tsx`
  - Fetch with `getProject()` and related data
  - Hybrid approach: real data for basic fields, mock data for features not in DB yet

---

## Phase 3: Tasks & Workstreams - COMPLETED

### 3.1 Workstream Actions - COMPLETED

- [x] **3.1.1** Create `lib/actions/workstreams.ts`
  - `createWorkstream(projectId, name)`
  - `updateWorkstream(id, data)`
  - `deleteWorkstream(id)`
  - `getWorkstreams(projectId)`
  - `reorderWorkstreams(projectId, workstreamIds[])`

### 3.2 Task Actions - COMPLETED

- [x] **3.2.1** Create `lib/actions/tasks.ts`
  - `createTask(projectId, data)`
  - `updateTask(id, data)`
  - `deleteTask(id)`
  - `getTasks(projectId, filters)`
  - `getTasksByWorkstream(workstreamId)` (via getTasks with workstreamId filter)
  - `reorderTasks(workstreamId, taskIds[])`
  - `moveTaskToWorkstream(taskId, newWorkstreamId, newIndex)`

### 3.3 Wire Up Components - COMPLETED

- [x] **3.3.1** Update `components/projects/WorkstreamTab.tsx`
  - Connected to real Supabase data with optimistic updates
  - Task status toggle with server action
  - Drag-and-drop reordering within/between workstreams
  - Server-side persistence for all changes
- [x] **3.3.2** Update `components/projects/ProjectTasksTab.tsx`
  - Connected to real Supabase data with optimistic updates
  - Task status toggle with server action
  - Drag-and-drop reordering with server persistence
  - Filter functionality preserved
- [x] **3.3.3** Update `components/tasks/MyTasksPage.tsx`
  - Converted to server-fetched data via `app/tasks/page.tsx`
  - Task CRUD operations with server actions
  - Groups tasks by project with proper type conversion
  - Task date move, tag change with optimistic updates
- [x] **3.3.4** Update `components/tasks/TaskQuickCreateModal.tsx`
  - Connected to `createTask` and `updateTask` server actions
  - Dynamic project/workstream selection from real data
  - Task editing mode with full field support
- [x] **3.3.5** `TaskWeekBoardView.tsx` - No changes needed
  - Works with props passed from parent components
  - Parents now provide real data

### 3.4 Supporting Files Created

- [x] **3.4.1** `lib/utils/task-converters.ts`
  - `toWorkstreamTask()` - Convert Supabase task to UI WorkstreamTask
  - `toProjectTask()` - Convert Supabase task to UI ProjectTask
  - `toWorkstreamGroups()` - Convert workstreams+tasks to UI groups
  - `computeDueInfo()` - Calculate due labels and tones

---

## Phase 4: Files, Notes & AI

### 4.1 File Actions

- [ ] **4.1.1** Create `lib/actions/files.ts`
  - `uploadFile(projectId, file, metadata)`
  - `deleteFile(id)`
  - `getProjectFiles(projectId)`
  - `getFileUrl(storagePath)`

- [ ] **4.1.2** Update file upload components

### 4.2 Note Actions

- [ ] **4.2.1** Create `lib/actions/notes.ts`
  - `createNote(projectId, data)`
  - `updateNote(id, data)`
  - `deleteNote(id)`
  - `getProjectNotes(projectId)`

- [ ] **4.2.2** Update note components

### 4.3 AI Integration

- [ ] **4.3.1** Create `lib/actions/user-settings.ts`
  - `saveAISettings(userId, provider, apiKey)`
  - `getAISettings(userId)`

- [ ] **4.3.2** Create `lib/actions/ai.ts`
  - `generateText(prompt, context)`
  - `generateProjectDescription(projectContext)`
  - `generateTasks(projectContext)`

- [ ] **4.3.3** Create `app/(dashboard)/settings/ai/page.tsx`

---

## Phase 5: Real-time & Polish

### 5.1 Real-time Setup

- [ ] **5.1.1** Enable Realtime in Supabase dashboard
- [ ] **5.1.2** Create `hooks/use-realtime.ts`
- [ ] **5.1.3** Integrate realtime hooks into components

### 5.2 Final Integration

- [ ] **5.2.1** Update `app/layout.tsx` with providers
- [ ] **5.2.2** Update `components/app-sidebar.tsx` with user info
- [ ] **5.2.3** Create `app/(dashboard)/layout.tsx`

### 5.3 Testing & Deployment

- [x] **5.3.1** Test all auth flows (Playwright MCP)
  - Email/password signup with validation ✅
  - Email/password login with error handling ✅
  - Google OAuth redirect flow ✅
  - Forgot password page and flow ✅
  - Form validation (required, email format, password length) ✅
- [x] **5.3.2** Test organization flows
  - Organization creation via onboarding ✅
  - Fixed RLS policy for organization_members INSERT ✅
  - Migration: `fix_organization_members_insert_policy`
- [x] **5.3.3** Test data isolation (RLS)
  - Projects visible only to organization members ✅
  - Clients visible only to organization members ✅
- [ ] **5.3.4** Test real-time
- [x] **5.3.5** Configure Vercel environment variables
  - NEXT_PUBLIC_SUPABASE_URL ✅
  - NEXT_PUBLIC_SUPABASE_ANON_KEY ✅
  - SUPABASE_SERVICE_ROLE_KEY ✅
  - NEXT_PUBLIC_SITE_URL ✅
- [x] **5.3.6** Deploy to Vercel
  - Main branch linked for auto-deployment ✅
  - Production URL: https://pms-nine-gold.vercel.app
- [x] **5.3.7** Configure OAuth redirect URLs
  - Google Cloud Console: Added Supabase callback URL ✅
  - Google Cloud Console: Added Vercel production callback URL ✅
  - Supabase: Site URL updated to production URL ✅
  - Supabase: Google provider enabled with OAuth credentials ✅
- [x] **5.3.8** Final smoke test
  - Google OAuth login ✅
  - Organization creation (via manual setup) ✅
  - Project creation via wizard ✅
  - Project details page ✅
  - Client creation ✅
  - Client details page ✅
  - Vercel domain alias: pms-nine-gold.vercel.app ✅

---

## Files Created in Phase 1

```
lib/
├── supabase/
│   ├── client.ts          # Browser Supabase client
│   ├── server.ts          # Server Supabase client (cookies)
│   ├── admin.ts           # Service role client
│   └── types.ts           # Database types
├── actions/
│   ├── auth.ts            # Auth server actions
│   ├── organizations.ts   # Organization server actions
│   └── types.ts           # Shared ActionResult type

components/
└── ui/
    └── form.tsx           # shadcn/ui Form component (React Hook Form)

app/
├── (auth)/
│   ├── layout.tsx         # Auth layout
│   ├── login/page.tsx     # Login page (with Zod validation)
│   ├── signup/page.tsx    # Signup page (with Zod validation)
│   └── forgot-password/page.tsx  # Password reset page
├── auth/
│   └── callback/route.ts  # OAuth callback
├── onboarding/
│   └── page.tsx           # Organization onboarding

middleware.ts              # Route protection

supabase/
├── config.toml            # Supabase config
└── migrations/
    ├── 20260122000001_initial_schema.sql
    ├── 20260122000002_rls_policies.sql
    └── 20260122000003_storage.sql

.env.local                 # Environment variables (not committed)
```

---

## Checkpoints

| Phase | Checkpoint | Status |
|-------|------------|--------|
| 1 | Auth works | COMPLETED |
| 1 | Org created | COMPLETED |
| 1 | Forgot password | COMPLETED |
| 1 | Form validation | COMPLETED |
| 2 | Projects CRUD | COMPLETED (Full Integration) |
| 2 | Clients CRUD | COMPLETED (Full Integration) |
| 2 | Components wired | COMPLETED |
| 3 | Tasks work | COMPLETED (Server Actions) |
| 3 | Task components | Pending |
| 4 | Files upload | Pending |
| 4 | AI works | Pending |
| 5 | Real-time | Pending |
| 5 | Vercel configured | COMPLETED |
| 5 | OAuth configured | COMPLETED |
| 5 | Auth flows tested | COMPLETED |
| 5 | Deployed | COMPLETED (Auto-deploy on main) |
| 5 | E2E Smoke Test | COMPLETED |
