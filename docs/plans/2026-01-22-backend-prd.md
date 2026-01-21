# Product Requirements Document: PMS Backend

**Date**: 2026-01-22
**Status**: Approved
**Author**: Claude + Fares

---

## 1. Product Overview

### Summary

**PMS (Project Management System)** is a SaaS application that enables organizations to manage projects, tasks, clients, and team collaboration in real-time. The frontend already exists as a polished Next.js 16 application with mock data. This PRD covers the backend implementation using Supabase.

### Business Goals

1. **Multi-tenant SaaS** - Organizations sign up, invite team members, and manage their own isolated data
2. **Real-time collaboration** - Team members see updates instantly without refreshing
3. **Self-service onboarding** - Users can sign up, create an org, and start using immediately

### Technical Goals

1. Replace all mock data with Supabase PostgreSQL
2. Implement authentication with Email/Password + Google OAuth
3. Add Row Level Security (RLS) for data isolation between organizations
4. Enable real-time subscriptions for live updates
5. Support file uploads up to 100MB (documents, images, audio, video)
6. AI-assisted creation - Users provide their own API keys (OpenAI, Google, Groq) to power AI features

### Out of Scope (MVP)

- Billing/Stripe integration (Phase 2+)
- Mobile app
- Audio transcription (Phase 2+)
- Email notifications

### Infrastructure

| Component | Choice |
|-----------|--------|
| Frontend Hosting | Vercel |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| File Storage | Supabase Storage |
| Real-time | Supabase Realtime |
| Repository | GitHub (`Faresabdelghany/PMS`) |
| Supabase Project | `lazhmdyajdqbnxxwyxun` |

---

## 2. Users & Roles

### Organization Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: manage members, settings, billing, delete org |
| **Member** | Use the app, create projects, manage clients |

### Project Roles

| Role | Permissions |
|------|-------------|
| **Owner** | Full control: edit, delete, manage members |
| **PIC** (Person In Charge) | Edit project, manage tasks, assign members |
| **Member** | Create/edit tasks, upload files, add notes |
| **Viewer** | Read-only access to project data |

### User Flows

**Sign Up Flow:**
1. User signs up with Email/Password or Google OAuth
2. System creates a `profile` record (synced from Supabase Auth)
3. User is prompted to create an organization or accept a pending invitation
4. If creating org → becomes Org Admin
5. If accepting invite → joins with assigned role

**Invitation Flow:**
1. Org Admin invites user by email
2. System creates invitation with unique token (expires in 7 days)
3. Invitee receives link `/invite/[token]`
4. If invitee has account → joins org immediately
5. If no account → signs up first, then joins org

### Data Isolation

- Users can belong to **multiple organizations**
- Each org's data is completely isolated via Row Level Security (RLS)
- Users only see data from orgs they belong to
- Project-level permissions further restrict access within an org

---

## 3. Database Schema

### Enums

```sql
-- Project enums
project_status: backlog | planned | active | cancelled | completed
project_priority: urgent | high | medium | low
project_intent: delivery | experiment | internal
success_type: deliverable | metric | undefined
deadline_type: none | target | fixed
work_structure: linear | milestones | multistream

-- Task enums
task_status: todo | in-progress | done
task_priority: no-priority | low | medium | high | urgent

-- Client enums
client_status: prospect | active | on_hold | archived

-- Role enums
org_member_role: admin | member
project_member_role: owner | pic | member | viewer

-- Other enums
invitation_status: pending | accepted | cancelled | expired
note_type: general | meeting | audio
note_status: completed | processing
file_type: pdf | zip | fig | doc | file | image | video | audio
```

### Core Tables

```sql
-- Synced from auth.users via trigger
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE,
  user_id UUID REFERENCES profiles ON DELETE CASCADE,
  role org_member_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id)
)

teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE,
  email TEXT NOT NULL,
  role org_member_role DEFAULT 'member',
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  status invitation_status DEFAULT 'pending',
  invited_by_id UUID REFERENCES profiles,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ DEFAULT now()
)
```

### Business Tables

```sql
clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  status client_status DEFAULT 'prospect',
  industry TEXT,
  website TEXT,
  location TEXT,
  owner_id UUID REFERENCES profiles,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  segment TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations ON DELETE CASCADE,
  team_id UUID REFERENCES teams,
  client_id UUID REFERENCES clients,
  name TEXT NOT NULL,
  description TEXT,
  status project_status DEFAULT 'planned',
  priority project_priority DEFAULT 'medium',
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  start_date DATE,
  end_date DATE,
  -- Extended fields from wizard
  intent project_intent,
  success_type success_type DEFAULT 'undefined',
  deadline_type deadline_type DEFAULT 'none',
  deadline_date DATE,
  work_structure work_structure DEFAULT 'linear',
  type_label TEXT,
  duration_label TEXT,
  location TEXT,
  group_label TEXT,
  label_badge TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  user_id UUID REFERENCES profiles ON DELETE CASCADE,
  role project_member_role DEFAULT 'member',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(project_id, user_id)
)

-- Project scope items (in-scope and out-of-scope)
project_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  item TEXT NOT NULL,
  is_in_scope BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Project outcomes
project_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  item TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Key features with priority levels (P0, P1, P2)
project_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  item TEXT NOT NULL,
  priority INTEGER DEFAULT 1 CHECK (priority IN (0, 1, 2)),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Deliverables from wizard
project_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
)

-- Metrics from wizard
project_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  name TEXT NOT NULL,
  target TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
)

workstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  workstream_id UUID REFERENCES workstreams ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo',
  priority task_priority DEFAULT 'no-priority',
  tag TEXT,
  assignee_id UUID REFERENCES profiles,
  start_date DATE,
  end_date DATE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type file_type DEFAULT 'file',
  size_bytes BIGINT DEFAULT 0,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  is_link_asset BOOLEAN DEFAULT false,
  added_by_id UUID REFERENCES profiles,
  created_at TIMESTAMPTZ DEFAULT now()
)

project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  note_type note_type DEFAULT 'general',
  status note_status DEFAULT 'completed',
  added_by_id UUID REFERENCES profiles,
  audio_data JSONB,  -- {duration, fileName, aiSummary, keyPoints[], insights[], transcript[]}
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)

-- User settings for AI API keys
user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles ON DELETE CASCADE UNIQUE,
  ai_provider TEXT,  -- openai | google | groq | anthropic | custom
  ai_api_key_encrypted TEXT,
  ai_model_preference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
)
```

### RLS Helper Functions

```sql
-- Check if user is member of organization
CREATE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user is admin of organization
CREATE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user is member of project
CREATE FUNCTION is_project_member(proj_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = proj_id
    AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Get org_id from project
CREATE FUNCTION get_project_org_id(proj_id UUID)
RETURNS UUID AS $$
  SELECT organization_id FROM projects WHERE id = proj_id;
$$ LANGUAGE sql SECURITY DEFINER;
```

### RLS Policies Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| profiles | Own profile or same org | Auth trigger | Own only | Never |
| organizations | Is member | Authenticated | Is admin | Is admin |
| organization_members | Is member | Is admin | Is admin | Is admin |
| clients | Is org member | Is org member | Is org member | Is org admin |
| projects | Is org member | Is org member | Is project member | Is project owner |
| tasks | Is org member | Is project member | Is project member | Is project member |
| project_files | Is org member | Is project member | Owner only | Owner or admin |
| project_notes | Is org member | Is project member | Owner only | Owner or admin |

---

## 4. API Layer (Server Actions)

### Authentication (`lib/actions/auth.ts`)
- `signUp(email, password, fullName)` - Create account + profile
- `signIn(email, password)` - Email/password login
- `signInWithOAuth(provider)` - Google OAuth redirect
- `signOut()` - Clear session
- `resetPassword(email)` - Send reset email
- `updatePassword(newPassword)` - Change password

### Organizations (`lib/actions/organizations.ts`)
- `createOrganization(name, slug)` - Create org, add user as admin
- `updateOrganization(id, data)` - Update name, logo
- `deleteOrganization(id)` - Delete org (admin only)
- `getOrganization(id)` - Get org details
- `getUserOrganizations()` - List user's orgs
- `switchOrganization(id)` - Set active org in session

### Members & Invitations (`lib/actions/members.ts`)
- `inviteMember(orgId, email, role)` - Send invitation
- `acceptInvitation(token)` - Join org via invite
- `cancelInvitation(id)` - Cancel pending invite
- `removeMember(orgId, userId)` - Remove from org
- `updateMemberRole(orgId, userId, role)` - Change role
- `getOrgMembers(orgId)` - List members

### Projects (`lib/actions/projects.ts`)
- `createProject(data)` - Full wizard data
- `updateProject(id, data)` - Partial update
- `deleteProject(id)` - Soft delete
- `getProject(id)` - Full details with relations
- `getProjects(filters)` - List with filters, pagination
- `addProjectMember(projectId, userId, role)`
- `removeProjectMember(projectId, userId)`
- `updateProjectProgress(id, progress)`

### Tasks (`lib/actions/tasks.ts`)
- `createTask(projectId, data)` - Create task
- `updateTask(id, data)` - Update task
- `deleteTask(id)` - Delete task
- `reorderTasks(workstreamId, taskIds[])` - Drag-drop reorder
- `moveTaskToWorkstream(taskId, wsId)` - Move between workstreams
- `bulkUpdateTaskStatus(ids[], status)` - Batch status change

### Clients (`lib/actions/clients.ts`)
- `createClient(data)` - Create client
- `updateClient(id, data)` - Update client
- `deleteClient(id)` - Archive client
- `getClient(id)` - Get with projects count
- `getClients(filters)` - List with filters

### Files & Notes (`lib/actions/files.ts`, `lib/actions/notes.ts`)
- `uploadFile(projectId, file)` - Upload to Supabase Storage
- `deleteFile(id)` - Remove file
- `createNote(projectId, data)` - Create note
- `updateNote(id, data)` - Update note
- `deleteNote(id)` - Delete note

### AI (`lib/actions/ai.ts`)
- `saveAISettings(provider, apiKey)` - Save encrypted API key
- `generateProjectDescription(prompt)` - AI-assisted writing
- `generateTasks(projectContext)` - AI task suggestions

---

## 5. Real-time Subscriptions

### Channels

| Channel | Tables | Events | Use Case |
|---------|--------|--------|----------|
| `org:{orgId}` | projects, clients | INSERT, UPDATE, DELETE | Project list updates |
| `project:{projectId}` | tasks, workstreams, notes, files | INSERT, UPDATE, DELETE | Project detail live sync |
| `project:{projectId}:tasks` | tasks | UPDATE | Task drag-drop sync |
| `user:{userId}` | invitations, organization_members | INSERT | New invite notifications |

### Client Hooks

```typescript
useRealtimeProjects(orgId)      // Subscribe to project changes
useRealtimeTasks(projectId)     // Subscribe to task changes
useRealtimeNotes(projectId)     // Subscribe to note changes
useRealtimeInvitations(userId)  // Subscribe to new invites
```

---

## 6. File Storage

### Buckets

| Bucket | Access | Max Size | Allowed Types |
|--------|--------|----------|---------------|
| `project-files` | Private (RLS) | 50MB | pdf, doc, docx, xls, xlsx, zip, fig |
| `project-images` | Private (RLS) | 10MB | png, jpg, jpeg, gif, webp, svg |
| `project-media` | Private (RLS) | 100MB | mp3, mp4, wav, webm |
| `avatars` | Public | 2MB | png, jpg, jpeg, webp |
| `org-logos` | Public | 5MB | png, jpg, jpeg, svg, webp |

### Storage Policies
- **Upload**: User must be org member
- **Download**: User must be org member (private) or public bucket
- **Delete**: User must be file owner OR org admin

---

## 7. Implementation Phases

### Phase 1: Foundation (Setup & Auth)
1. Initialize git repo, push to GitHub
2. Install Vercel CLI, link project
3. Link Supabase project with CLI
4. Run database migration (all tables, enums, RLS)
5. Create Supabase client utilities
6. Implement auth Server Actions
7. Create auth pages (login, signup, callback)
8. Add middleware for route protection
9. Create organization on first login flow

### Phase 2: Core Data Layer
1. Implement organization & team actions
2. Implement member & invitation actions
3. Implement project CRUD actions
4. Implement client CRUD actions
5. Replace mock data imports in existing components
6. Wire up project wizard to create real projects

### Phase 3: Tasks & Workstreams
1. Implement workstream CRUD actions
2. Implement task CRUD actions
3. Implement drag-drop reordering
4. Wire up WorkstreamTab component
5. Wire up MyTasksPage component
6. Wire up task quick-create modal

### Phase 4: Files, Notes & AI
1. Configure storage buckets with policies
2. Implement file upload/download actions
3. Implement notes CRUD actions
4. Wire up AssetsFilesTab and NotesTab
5. Create user settings for AI keys
6. Implement AI actions
7. Wire up "Ask AI" buttons

### Phase 5: Real-time & Polish
1. Enable Supabase Realtime on tables
2. Create realtime hooks
3. Add live updates to project/task views
4. Add invitation notifications
5. Test end-to-end flows
6. Deploy to Vercel production

---

## 8. Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://lazhmdyajdqbnxxwyxun.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# OAuth (configured in Supabase dashboard)
# Google Client ID/Secret
# GitHub Client ID/Secret (optional)
```

---

## 9. Success Criteria

1. **Auth**: Sign up, sign in, OAuth flow, sign out all work
2. **Organizations**: Create org, invite member, accept invite, change roles
3. **Projects**: Full CRUD with wizard, filters, timeline view
4. **Tasks**: CRUD, drag-drop reorder, status updates
5. **Files**: Upload up to 100MB, download, delete
6. **Real-time**: Changes sync across browsers within 1 second
7. **RLS**: User A cannot see User B's organization data
8. **AI**: Users can save API keys and use AI features
9. **Deploy**: Production build works on Vercel
