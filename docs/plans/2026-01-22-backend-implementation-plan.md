# Implementation Plan: PMS Backend

**Date**: 2026-01-22
**PRD Reference**: `docs/plans/2026-01-22-backend-prd.md`
**Estimated Tasks**: 47

---

## Phase 1: Foundation (Setup & Auth)

### 1.1 Repository & Tooling Setup

- [ ] **1.1.1** Initialize git repository
  ```bash
  git init
  git remote add origin https://github.com/Faresabdelghany/PMS.git
  ```

- [ ] **1.1.2** Install Vercel CLI and link project
  ```bash
  pnpm add -g vercel
  vercel login
  vercel link
  ```

- [ ] **1.1.3** Install Supabase CLI
  ```bash
  pnpm add -D supabase
  npx supabase login
  npx supabase link --project-ref lazhmdyajdqbnxxwyxun
  ```

- [ ] **1.1.4** Create `.env.local` with Supabase credentials
  ```
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_ANON_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  NEXT_PUBLIC_SITE_URL=http://localhost:3000
  ```

- [ ] **1.1.5** Add `.env.local` to `.gitignore`

- [ ] **1.1.6** Initial commit and push
  ```bash
  git add .
  git commit -m "Initial commit: Next.js 16 project dashboard"
  git push -u origin main
  ```

### 1.2 Database Migration

- [ ] **1.2.1** Create migration file: `supabase/migrations/001_initial_schema.sql`
  - All enums
  - All tables (profiles, organizations, organization_members, teams, invitations, clients, projects, project_members, project_scope, project_outcomes, project_features, project_deliverables, project_metrics, workstreams, tasks, project_files, project_notes, user_settings)
  - All indexes
  - Profile sync trigger from auth.users

- [ ] **1.2.2** Create RLS policies file: `supabase/migrations/002_rls_policies.sql`
  - Helper functions (is_org_member, is_org_admin, is_project_member)
  - Policies for all tables

- [ ] **1.2.3** Create storage buckets file: `supabase/migrations/003_storage.sql`
  - Create buckets: project-files, project-images, project-media, avatars, org-logos
  - Storage policies

- [ ] **1.2.4** Run migrations
  ```bash
  npx supabase db push
  ```

- [ ] **1.2.5** Generate TypeScript types
  ```bash
  npx supabase gen types typescript --project-id lazhmdyajdqbnxxwyxun > lib/supabase/database.types.ts
  ```

### 1.3 Supabase Client Setup

- [ ] **1.3.1** Create `lib/supabase/client.ts` - Browser client
- [ ] **1.3.2** Create `lib/supabase/server.ts` - Server client with cookies
- [ ] **1.3.3** Create `lib/supabase/admin.ts` - Service role client
- [ ] **1.3.4** Create `lib/supabase/types.ts` - Re-export and extend generated types

### 1.4 Authentication

- [ ] **1.4.1** Create `lib/actions/auth.ts`
  - `signUp(email, password, fullName)`
  - `signIn(email, password)`
  - `signInWithOAuth(provider: 'google')`
  - `signOut()`
  - `resetPassword(email)`
  - `updatePassword(newPassword)`
  - `getSession()`
  - `getUser()`

- [ ] **1.4.2** Create `app/(auth)/layout.tsx` - Auth layout (centered, no sidebar)

- [ ] **1.4.3** Create `app/(auth)/login/page.tsx`
  - Email/password form
  - Google OAuth button
  - Link to signup
  - Link to reset password

- [ ] **1.4.4** Create `app/(auth)/signup/page.tsx`
  - Email/password/name form
  - Google OAuth button
  - Link to login

- [ ] **1.4.5** Create `app/(auth)/callback/route.ts` - OAuth callback handler

- [ ] **1.4.6** Create `app/(auth)/reset-password/page.tsx` - Password reset form

- [ ] **1.4.7** Create `middleware.ts` - Route protection
  - Protect all routes except `/login`, `/signup`, `/callback`, `/invite/*`
  - Redirect unauthenticated users to `/login`
  - Redirect authenticated users from auth pages to `/`

### 1.5 Organization First-Login Flow

- [ ] **1.5.1** Create `app/(auth)/onboarding/page.tsx`
  - Check if user has any organizations
  - If no orgs: show "Create Organization" form
  - If pending invites: show option to accept
  - Create org → redirect to dashboard

- [ ] **1.5.2** Create `lib/actions/organizations.ts`
  - `createOrganization(name, slug)`
  - `getOrganization(id)`
  - `getUserOrganizations()`

- [ ] **1.5.3** Create `hooks/use-organization.ts` - Organization context hook
  - Current organization state
  - Switch organization function

- [ ] **1.5.4** Create `components/providers/organization-provider.tsx`
  - Wrap app with organization context
  - Store current org in cookie/localStorage

---

## Phase 2: Core Data Layer

### 2.1 Organization Management

- [ ] **2.1.1** Extend `lib/actions/organizations.ts`
  - `updateOrganization(id, data)`
  - `deleteOrganization(id)`
  - `switchOrganization(id)`

- [ ] **2.1.2** Create `lib/actions/teams.ts`
  - `createTeam(orgId, name, description)`
  - `updateTeam(id, data)`
  - `deleteTeam(id)`
  - `getTeams(orgId)`

- [ ] **2.1.3** Create `lib/actions/members.ts`
  - `inviteMember(orgId, email, role)`
  - `acceptInvitation(token)`
  - `cancelInvitation(id)`
  - `removeMember(orgId, userId)`
  - `updateMemberRole(orgId, userId, role)`
  - `getOrgMembers(orgId)`
  - `getPendingInvitations(orgId)`

- [ ] **2.1.4** Create `app/invite/[token]/page.tsx` - Invitation acceptance page

- [ ] **2.1.5** Create `app/(dashboard)/settings/organization/page.tsx`
  - Org name, logo, slug
  - Members list with roles
  - Invite new member form
  - Danger zone: delete org

### 2.2 Client Management

- [ ] **2.2.1** Create `lib/actions/clients.ts`
  - `createClient(data)`
  - `updateClient(id, data)`
  - `deleteClient(id)`
  - `getClient(id)`
  - `getClients(orgId, filters)`
  - `getClientProjectCount(clientId)`

- [ ] **2.2.2** Update `components/clients-content.tsx`
  - Replace mock data with `getClients()` call
  - Wire up ClientWizard to `createClient()`

- [ ] **2.2.3** Update `components/clients/ClientDetailsPage.tsx`
  - Fetch client with `getClient()`
  - Wire up edit functionality

- [ ] **2.2.4** Update `components/clients/ClientWizard.tsx`
  - Call `createClient()` or `updateClient()` on submit

### 2.3 Project Management

- [ ] **2.3.1** Create `lib/actions/projects.ts`
  - `createProject(data)` - Full wizard data
  - `updateProject(id, data)`
  - `deleteProject(id)`
  - `getProject(id)` - With all relations
  - `getProjects(orgId, filters)` - List with pagination
  - `addProjectMember(projectId, userId, role)`
  - `removeProjectMember(projectId, userId)`
  - `updateProjectProgress(id, progress)`

- [ ] **2.3.2** Create `lib/actions/project-details.ts`
  - `getProjectScope(projectId)`
  - `updateProjectScope(projectId, inScope[], outOfScope[])`
  - `getProjectOutcomes(projectId)`
  - `updateProjectOutcomes(projectId, outcomes[])`
  - `getProjectFeatures(projectId)`
  - `updateProjectFeatures(projectId, features[])`

- [ ] **2.3.3** Update `components/projects-content.tsx`
  - Replace mock `projects` import with `getProjects()` call
  - Wire up filters to query params

- [ ] **2.3.4** Update `components/project-wizard/ProjectWizard.tsx`
  - Call `createProject()` on submit
  - Pass all wizard data (intent, outcomes, ownership, structure)

- [ ] **2.3.5** Update `components/projects/ProjectDetailsPage.tsx`
  - Fetch with `getProject()`
  - Replace `getProjectDetailsById()` mock function

- [ ] **2.3.6** Update project detail components
  - `ScopeColumns.tsx` - Fetch/update scope
  - `OutcomesList.tsx` - Fetch/update outcomes
  - `KeyFeaturesColumns.tsx` - Fetch/update features

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
  - `bulkUpdateTaskStatus(taskIds[], status)`

### 3.3 Wire Up Components

- [ ] **3.3.1** Update `components/projects/WorkstreamTab.tsx`
  - Fetch workstreams with tasks
  - Implement drag-drop with `reorderTasks()` and `moveTaskToWorkstream()`
  - Task create/edit/delete

- [ ] **3.3.2** Update `components/projects/ProjectTasksTab.tsx`
  - Fetch tasks from Supabase
  - Wire up task actions

- [ ] **3.3.3** Update `components/tasks/MyTasksPage.tsx`
  - Fetch user's tasks across all projects
  - Group by project
  - Wire up task actions

- [ ] **3.3.4** Update `components/tasks/TaskQuickCreateModal.tsx`
  - Call `createTask()` on submit
  - Fetch workstreams for dropdown

- [ ] **3.3.5** Update `components/tasks/TaskWeekBoardView.tsx`
  - Fetch tasks for week view
  - Wire up drag-drop

---

## Phase 4: Files, Notes & AI

### 4.1 Storage Setup

- [ ] **4.1.1** Verify storage buckets created via migration
- [ ] **4.1.2** Configure CORS for storage buckets in Supabase dashboard

### 4.2 File Actions

- [ ] **4.2.1** Create `lib/actions/files.ts`
  - `uploadFile(projectId, file, metadata)`
  - `deleteFile(id)`
  - `getProjectFiles(projectId)`
  - `getFileUrl(storagePath)` - Generate signed URL

- [ ] **4.2.2** Update `components/projects/AssetsFilesTab.tsx`
  - Fetch files with `getProjectFiles()`
  - Wire up upload modal

- [ ] **4.2.3** Update `components/projects/UploadAssetFilesModal.tsx`
  - Call `uploadFile()` on submit
  - Show upload progress

- [ ] **4.2.4** Update `components/projects/AddFileModal.tsx`
  - Support both file upload and link assets

### 4.3 Note Actions

- [ ] **4.3.1** Create `lib/actions/notes.ts`
  - `createNote(projectId, data)`
  - `updateNote(id, data)`
  - `deleteNote(id)`
  - `getProjectNotes(projectId)`
  - `getNote(id)`

- [ ] **4.3.2** Update `components/projects/NotesTab.tsx`
  - Fetch notes with `getProjectNotes()`

- [ ] **4.3.3** Update `components/projects/CreateNoteModal.tsx`
  - Call `createNote()` on submit

- [ ] **4.3.4** Update `components/projects/NotePreviewModal.tsx`
  - Fetch full note data
  - Support edit mode

### 4.4 AI Integration

- [ ] **4.4.1** Create `lib/actions/ai.ts`
  - `saveAISettings(userId, provider, apiKey)`
  - `getAISettings(userId)`
  - `generateText(prompt, context)` - Generic AI call
  - `generateProjectDescription(projectContext)`
  - `generateTasks(projectContext)`

- [ ] **4.4.2** Create `app/(dashboard)/settings/ai/page.tsx`
  - AI provider selection
  - API key input (encrypted storage)
  - Model preference

- [ ] **4.4.3** Create `components/ai/AskAIDialog.tsx`
  - Reusable AI dialog component
  - Shows loading state
  - Displays AI response

- [ ] **4.4.4** Wire up "Ask AI" buttons
  - `components/project-header.tsx`
  - `components/tasks/MyTasksPage.tsx`
  - `components/project-wizard/ProjectDescriptionEditor.tsx`

---

## Phase 5: Real-time & Polish

### 5.1 Real-time Setup

- [ ] **5.1.1** Enable Realtime in Supabase dashboard for tables:
  - projects, tasks, workstreams, project_notes, project_files

- [ ] **5.1.2** Create `hooks/use-realtime.ts`
  - `useRealtimeProjects(orgId)`
  - `useRealtimeTasks(projectId)`
  - `useRealtimeWorkstreams(projectId)`
  - `useRealtimeNotes(projectId)`
  - `useRealtimeFiles(projectId)`

- [ ] **5.1.3** Integrate realtime hooks into components
  - Project list auto-updates
  - Task board live sync
  - Notes/files live updates

### 5.2 Final Integration

- [ ] **5.2.1** Update `app/layout.tsx`
  - Add Supabase auth provider
  - Add organization provider

- [ ] **5.2.2** Update `components/app-sidebar.tsx`
  - Show current user info
  - Show user's organizations
  - Logout button

- [ ] **5.2.3** Create `app/(dashboard)/layout.tsx`
  - Protected layout wrapper
  - Requires authentication
  - Requires organization

### 5.3 Testing & Deployment

- [ ] **5.3.1** Test all auth flows
  - Sign up, sign in, OAuth, sign out
  - Password reset

- [ ] **5.3.2** Test organization flows
  - Create org, invite member, accept invite
  - Change roles, remove member

- [ ] **5.3.3** Test data isolation (RLS)
  - Create two users in different orgs
  - Verify data isolation

- [ ] **5.3.4** Test real-time
  - Open two browsers
  - Verify changes sync

- [ ] **5.3.5** Configure Vercel environment variables
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  NEXT_PUBLIC_SITE_URL
  ```

- [ ] **5.3.6** Deploy to Vercel
  ```bash
  vercel --prod
  ```

- [ ] **5.3.7** Configure OAuth redirect URLs in Supabase
  - Add production URL to allowed redirects

- [ ] **5.3.8** Final smoke test on production

---

## File Structure Summary

```
lib/
├── supabase/
│   ├── client.ts
│   ├── server.ts
│   ├── admin.ts
│   ├── types.ts
│   └── database.types.ts (generated)
├── actions/
│   ├── auth.ts
│   ├── organizations.ts
│   ├── teams.ts
│   ├── members.ts
│   ├── projects.ts
│   ├── project-details.ts
│   ├── workstreams.ts
│   ├── tasks.ts
│   ├── clients.ts
│   ├── files.ts
│   ├── notes.ts
│   └── ai.ts
hooks/
├── use-auth.ts
├── use-organization.ts
├── use-realtime.ts
app/
├── (auth)/
│   ├── layout.tsx
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   ├── callback/route.ts
│   ├── reset-password/page.tsx
│   └── onboarding/page.tsx
├── (dashboard)/
│   ├── layout.tsx
│   └── settings/
│       ├── organization/page.tsx
│       ├── profile/page.tsx
│       └── ai/page.tsx
├── invite/[token]/page.tsx
└── middleware.ts
supabase/
└── migrations/
    ├── 001_initial_schema.sql
    ├── 002_rls_policies.sql
    └── 003_storage.sql
components/
├── providers/
│   └── organization-provider.tsx
└── ai/
    └── AskAIDialog.tsx
```

---

## Checkpoints

| Phase | Checkpoint | Verification |
|-------|------------|--------------|
| 1 | Auth works | Can sign up, sign in, sign out |
| 1 | Org created | First login creates organization |
| 2 | Projects CRUD | Can create/edit/delete projects |
| 2 | Clients CRUD | Can create/edit/delete clients |
| 3 | Tasks work | Can create tasks, drag-drop reorder |
| 4 | Files upload | Can upload/download files |
| 4 | AI works | Can generate text with user's API key |
| 5 | Real-time | Changes sync across browsers |
| 5 | Deployed | Production URL works |
