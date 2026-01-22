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
  - Email/password form
  - Google OAuth button
  - Link to signup
  - Link to forgot password
  - Error display

- [x] **1.4.4** Create `app/(auth)/signup/page.tsx`
  - Email/password/name form
  - Google OAuth button
  - Link to login
  - Success state with email confirmation message

- [x] **1.4.5** Create `app/auth/callback/route.ts` - OAuth callback handler
  - Exchanges code for session
  - Checks if user has organization
  - Redirects to onboarding if no org

- [x] **1.4.7** Create `middleware.ts` - Route protection
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

## Phase 2: Core Data Layer

### 2.1 Organization Management

- [ ] **2.1.1** Create `lib/actions/teams.ts`
  - `createTeam(orgId, name, description)`
  - `updateTeam(id, data)`
  - `deleteTeam(id)`
  - `getTeams(orgId)`

- [ ] **2.1.2** Create `lib/actions/invitations.ts`
  - `inviteMember(orgId, email, role)`
  - `acceptInvitation(token)`
  - `cancelInvitation(id)`
  - `getPendingInvitations(orgId)`

- [ ] **2.1.3** Create `app/invite/[token]/page.tsx` - Invitation acceptance page

- [ ] **2.1.4** Create `app/(dashboard)/settings/organization/page.tsx`
  - Org name, logo, slug
  - Members list with roles
  - Invite new member form
  - Danger zone: delete org

- [ ] **2.1.5** Create `hooks/use-organization.ts` - Organization context hook

- [ ] **2.1.6** Create `components/providers/organization-provider.tsx`

### 2.2 Client Management

- [ ] **2.2.1** Create `lib/actions/clients.ts`
  - `createClient(data)`
  - `updateClient(id, data)`
  - `deleteClient(id)`
  - `getClient(id)`
  - `getClients(orgId, filters)`

- [ ] **2.2.2** Update `components/clients-content.tsx`
  - Replace mock data with `getClients()` call

- [ ] **2.2.3** Update `components/clients/ClientDetailsPage.tsx`
  - Fetch client with `getClient()`

- [ ] **2.2.4** Update `components/clients/ClientWizard.tsx`
  - Call `createClient()` or `updateClient()` on submit

### 2.3 Project Management

- [ ] **2.3.1** Create `lib/actions/projects.ts`
  - `createProject(data)`
  - `updateProject(id, data)`
  - `deleteProject(id)`
  - `getProject(id)`
  - `getProjects(orgId, filters)`
  - `addProjectMember(projectId, userId, role)`
  - `removeProjectMember(projectId, userId)`

- [ ] **2.3.2** Create `lib/actions/project-details.ts`
  - `getProjectScope(projectId)`
  - `updateProjectScope(projectId, inScope[], outOfScope[])`
  - `getProjectOutcomes(projectId)`
  - `updateProjectOutcomes(projectId, outcomes[])`
  - `getProjectFeatures(projectId)`
  - `updateProjectFeatures(projectId, features[])`

- [ ] **2.3.3** Update `components/projects-content.tsx`
  - Replace mock `projects` import with `getProjects()` call

- [ ] **2.3.4** Update `components/project-wizard/ProjectWizard.tsx`
  - Call `createProject()` on submit

- [ ] **2.3.5** Update `components/projects/ProjectDetailsPage.tsx`
  - Fetch with `getProject()`

---

## Phase 3: Tasks & Workstreams

### 3.1 Workstream Actions

- [ ] **3.1.1** Create `lib/actions/workstreams.ts`
  - `createWorkstream(projectId, name)`
  - `updateWorkstream(id, data)`
  - `deleteWorkstream(id)`
  - `getWorkstreams(projectId)`
  - `reorderWorkstreams(projectId, workstreamIds[])`

### 3.2 Task Actions

- [ ] **3.2.1** Create `lib/actions/tasks.ts`
  - `createTask(projectId, data)`
  - `updateTask(id, data)`
  - `deleteTask(id)`
  - `getTasks(projectId, filters)`
  - `getTasksByWorkstream(workstreamId)`
  - `reorderTasks(workstreamId, taskIds[])`
  - `moveTaskToWorkstream(taskId, newWorkstreamId, newIndex)`

### 3.3 Wire Up Components

- [ ] **3.3.1** Update `components/projects/WorkstreamTab.tsx`
- [ ] **3.3.2** Update `components/projects/ProjectTasksTab.tsx`
- [ ] **3.3.3** Update `components/tasks/MyTasksPage.tsx`
- [ ] **3.3.4** Update `components/tasks/TaskQuickCreateModal.tsx`
- [ ] **3.3.5** Update `components/tasks/TaskWeekBoardView.tsx`

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

- [ ] **5.3.1** Test all auth flows
- [ ] **5.3.2** Test organization flows
- [ ] **5.3.3** Test data isolation (RLS)
- [ ] **5.3.4** Test real-time
- [ ] **5.3.5** Configure Vercel environment variables
- [ ] **5.3.6** Deploy to Vercel
- [ ] **5.3.7** Configure OAuth redirect URLs
- [ ] **5.3.8** Final smoke test

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
│   └── organizations.ts   # Organization server actions

app/
├── (auth)/
│   ├── layout.tsx         # Auth layout
│   ├── login/page.tsx     # Login page
│   └── signup/page.tsx    # Signup page
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
| 2 | Projects CRUD | Pending |
| 2 | Clients CRUD | Pending |
| 3 | Tasks work | Pending |
| 4 | Files upload | Pending |
| 4 | AI works | Pending |
| 5 | Real-time | Pending |
| 5 | Deployed | Pending |
