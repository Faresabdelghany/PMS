# Features Documentation

This document provides a comprehensive list of all features in the Project Management SaaS application.

---

## 1. Authentication & Access Control

### Email & Password Authentication
| Feature | Description |
|---------|-------------|
| Sign Up | User registration with email, password, and full name |
| Sign In | User login with email and password |
| Password Reset | Forgot password flow with email reset |
| Password Update | Update password after reset |
| Auto-Create Workspace | Personal workspace created automatically on signup |

### OAuth Authentication
| Feature | Description |
|---------|-------------|
| Google OAuth | Third-party authentication via Google |
| OAuth Callback | Handle OAuth redirect and session creation |

### Session Management
| Feature | Description |
|---------|-------------|
| Sign Out | Clear session and redirect to login |
| Route Protection | Redirect unauthenticated users to login |
| Organization Check | Redirect users without org to onboarding |

---

## 2. Organization Management

### Organization CRUD
| Feature | Description |
|---------|-------------|
| Create Organization | Create new org with unique slug from onboarding |
| Get Organizations | Retrieve all organizations user belongs to |
| Update Organization | Modify organization details |
| Delete Organization | Remove organization |

### Member Management
| Feature | Description |
|---------|-------------|
| Get Members | List all members with roles and profiles |
| Update Member Role | Change member role (admin/member) |
| Remove Member | Remove member from organization |

### Team Management
| Feature | Description |
|---------|-------------|
| Create Team | Create teams within organization |
| Get Teams | List teams in organization |
| Update Team | Modify team details |
| Delete Team | Remove team |
| Manage Team Members | Add/remove members from teams |

### Invitations
| Feature | Description |
|---------|-------------|
| Invite Member | Send email invitation with role |
| Accept Invitation | User accepts and joins organization |
| Cancel Invitation | Admin cancels pending invitation |
| Resend Invitation | Send new invitation to same email |
| Get Pending Invitations | List all pending invitations |

---

## 3. Project Management

### Project Creation
| Feature | Description |
|---------|-------------|
| Multi-Step Wizard | 6-step creation: Mode, Intent, Outcome, Ownership, Structure, Review |
| Quick Create | Minimal form for fast project creation |
| AI-Assisted Description | Generate project description using AI |

### Project CRUD
| Feature | Description |
|---------|-------------|
| Create Project | Create with name, description, status, priority, client |
| Get Projects | List all projects with filtering and search |
| Get Single Project | Fetch project with all relations |
| Update Project | Modify project properties |
| Delete Project | Remove project and cascade delete related data |

### Project Status
| Feature | Description |
|---------|-------------|
| Status Values | backlog, planned, active, cancelled, completed |
| Priority Values | urgent, high, medium, low |
| Progress Tracking | 0-100% progress updates |
| Statistics | Count by status and priority |

### Project Membership
| Feature | Description |
|---------|-------------|
| Add Member | Add user with role (owner/pic/member/viewer) |
| Update Role | Change member's project role |
| Remove Member | Remove member from project |
| Auto-Add Owner | Creator automatically added as owner |

### Project Views
| Feature | Description |
|---------|-------------|
| List View | Display projects in list format |
| Grid View | Display projects in grid cards |
| Board View | Display projects in Kanban-style board |
| Project Details | Comprehensive project page with tabs |

---

## 4. Task Management

### Task CRUD
| Feature | Description |
|---------|-------------|
| Create Task | Create with name, description, status, priority, assignee |
| Get Tasks | List tasks with filtering by status, priority, assignee |
| Get User's Tasks | "My Tasks" - all tasks assigned to current user |
| Update Task | Modify task properties |
| Delete Task | Remove task from project |

### Task Organization
| Feature | Description |
|---------|-------------|
| Kanban Board | Columns: To Do, In Progress, Done |
| Drag-Drop | Move tasks between columns |
| Reorder Tasks | Change sort order within workstream |
| Assign to Workstream | Organize tasks into phases |
| Quick Create | Fast inline task creation |

### Task Assignment
| Feature | Description |
|---------|-------------|
| Assign User | Assign task to team member |
| Unassign | Remove assignee from task |
| Update Assignee | Change task assignment |

### Task Status & Priority
| Feature | Description |
|---------|-------------|
| Status Values | todo, in-progress, done |
| Priority Values | no-priority, low, medium, high, urgent |
| Bulk Update | Change multiple tasks' status at once |

---

## 5. Workstream Management

### Workstream CRUD
| Feature | Description |
|---------|-------------|
| Create Workstream | Create phase/milestone within project |
| Get Workstreams | List all workstreams ordered by sort_order |
| Get with Tasks | Fetch workstreams with nested tasks |
| Update Workstream | Modify name, description |
| Delete Workstream | Remove workstream |

### Workstream Organization
| Feature | Description |
|---------|-------------|
| Reorder | Change sort order of workstreams |
| Task Association | Tasks belong to workstreams |

---

## 6. Client Management

### Client CRUD
| Feature | Description |
|---------|-------------|
| Create Client | Add client with contact info and status |
| Get Clients | List with filtering by status, owner |
| Get with Project Count | Include associated project count |
| Update Client | Modify client properties |
| Delete Client | Remove (only if no associated projects) |

### Client Status
| Feature | Description |
|---------|-------------|
| Status Values | prospect, active, on_hold, archived |
| Statistics | Total count and count by status |

### Client Fields
| Feature | Description |
|---------|-------------|
| Basic Info | Name, status, owner |
| Contact Info | Primary contact name, email, phone |
| Additional | Website, address, notes |

---

## 7. File Management

### File Upload
| Feature | Description |
|---------|-------------|
| Upload to Storage | Upload to Supabase Storage |
| Document Types | PDF (50MB), DOC/DOCX (50MB), ZIP (50MB), FIG (50MB) |
| Image Types | PNG/JPG/GIF/WebP/SVG (10MB) |
| Media Types | MP4/WebM/MOV/AVI (100MB), MP3/WAV/OGG/M4A (100MB) |
| Auto Filename | Unique timestamp + random filename |

### File Operations
| Feature | Description |
|---------|-------------|
| Get Project Files | List all files with uploader info |
| Update File | Modify name, description |
| Delete File | Remove from storage and database |
| Get File URL | Generate signed URL for download |
| Download | Download file as blob |

### Link Assets
| Feature | Description |
|---------|-------------|
| Create Link | Add external link without upload |
| Auto-Detect Type | Detect file type from URL |
| Figma Support | Special handling for Figma links |

---

## 8. Notes & Documentation

### Note CRUD
| Feature | Description |
|---------|-------------|
| Create Note | Create with title, content, type |
| Get Notes | List with filtering by type, status |
| Update Note | Modify title, content, type |
| Delete Note | Remove note |
| Duplicate Note | Create copy with "(Copy)" suffix |

### Note Types
| Feature | Description |
|---------|-------------|
| General | Standard text notes |
| Meeting | Meeting notes and minutes |
| Decision | Decision documentation |
| Audio | Voice recordings with transcription |

### Rich Text Editor
| Feature | Description |
|---------|-------------|
| Tiptap Editor | Full rich text editing |
| Formatting | Bold, italic, lists, headings |
| Content Search | Search within note content |

### Audio Notes
| Feature | Description |
|---------|-------------|
| Record Audio | Record voice notes |
| Upload Audio | Upload audio files |
| Transcription | Store and display transcription |
| Audio Metadata | Duration, storage path |

---

## 9. AI-Powered Features

### AI Settings
| Feature | Description |
|---------|-------------|
| Provider Selection | OpenAI, Anthropic (Claude), Google Gemini |
| API Key Management | Store encrypted API keys |
| Model Selection | Choose preferred model |
| Connection Test | Verify API connectivity |

### AI Generation
| Feature | Description |
|---------|-------------|
| Project Description | Generate description from context |
| Task Suggestions | Generate task list for project |
| Workstream Suggestions | Generate phases for project |
| Note Enhancement | Format transcriptions into structured notes |
| Note Summarization | Create executive summary from notes |

### AI Configuration
| Feature | Description |
|---------|-------------|
| Max Tokens | Configure response length |
| Temperature | Configure creativity level |
| System Prompts | Custom system instructions |

---

## 10. Real-Time Features

### Supabase Realtime Subscriptions
| Feature | Description |
|---------|-------------|
| Tasks Realtime | Instant task updates (~50ms latency) |
| Workstreams Realtime | Real-time workstream changes |
| Projects Realtime | Project updates across users |
| Clients Realtime | Client data synchronization |
| Files Realtime | File upload/delete notifications |
| Notes Realtime | Note changes in real-time |
| Members Realtime | Organization member changes |

---

## 11. User Profile & Settings

### Profile Management
| Feature | Description |
|---------|-------------|
| Update Profile | Edit full name, avatar |
| View Profile | Display current profile info |

### Settings Pages
| Feature | Description |
|---------|-------------|
| Profile Settings | `/settings/profile` - Manage profile |
| Organization Settings | `/settings/organization` - Manage org and members |
| AI Settings | `/settings/ai` - Configure AI providers |

---

## 12. Dashboard & Navigation

### Main Views
| Feature | Description |
|---------|-------------|
| Home Dashboard | Organization overview and quick access |
| Projects List | All projects with filters |
| My Tasks | User's assigned tasks |
| Clients List | All clients with filters |

### Project Detail Views
| Feature | Description |
|---------|-------------|
| Overview Tab | Project metadata, description, scope |
| Tasks Tab | Kanban board view |
| Workstreams Tab | Phase management |
| Files Tab | Project documents and assets |
| Notes Tab | Project notes and documentation |

---

## 13. Search & Filtering

### Project Filters
| Filter | Options |
|--------|---------|
| Search | By name or description |
| Status | backlog, planned, active, cancelled, completed |
| Priority | urgent, high, medium, low |
| Client | Select from organization clients |
| Team | Select from organization teams |

### Task Filters
| Filter | Options |
|--------|---------|
| Search | By name or description |
| Status | todo, in-progress, done |
| Priority | no-priority, low, medium, high, urgent |
| Assignee | Select from project members |
| Workstream | Select from project workstreams |

### Client Filters
| Filter | Options |
|--------|---------|
| Search | By name, contact name, email |
| Status | prospect, active, on_hold, archived |
| Owner | Select from organization members |

### Note Filters
| Filter | Options |
|--------|---------|
| Search | By title or content |
| Type | general, meeting, decision, audio |
| Status | completed, processing |

---

## 14. UI Components

### View Options
| Component | Description |
|-----------|-------------|
| List View | Compact list format |
| Grid View | Card-based grid layout |
| Board View | Kanban-style columns |

### Interactive Components
| Component | Description |
|-----------|-------------|
| Drag-Drop | @dnd-kit powered reordering |
| Modals/Dialogs | Task create, file upload, note editor |
| Popovers | Filter options, view settings |
| Tooltips | Contextual help |
| Progress Bars | Visual progress indicators |
| Avatars | User profile images |
| Badges | Status and priority indicators |

### Form Components
| Component | Description |
|-----------|-------------|
| Input Fields | Text, email, password inputs |
| Select Dropdowns | Single and multi-select |
| Date Pickers | Calendar-based date selection |
| Rich Text Editor | Tiptap-powered editing |
| File Upload | Drag-drop file picker |

### Theme
| Feature | Description |
|---------|-------------|
| Light Mode | Default light theme |
| Dark Mode | Dark theme option |
| Theme Toggle | Switch between themes |

---

## 15. Validation & Error Handling

### Form Validation
| Form | Rules |
|------|-------|
| Login | Email format, password 8+ chars |
| Signup | Full name 2+ chars, email format, password 8+ chars |
| Organization | Name 2+ chars, unique slug |
| Project | Required name |
| Task | Required title |
| File Upload | Size limits per type, format validation |

### Business Logic
| Rule | Description |
|------|-------------|
| No Duplicate Members | Cannot add same member twice |
| Client Delete Check | Cannot delete client with projects |
| Invitation Expiry | Expired invitations cannot be accepted |
| Role-Based Access | Only admins manage organization |

---

## 16. Technology Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript (strict mode) |
| Styling | Tailwind CSS 4.1 |
| Components | shadcn/ui + Radix UI |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Real-time | Supabase Realtime |
| Forms | React Hook Form + Zod |
| Rich Text | Tiptap Editor |
| Drag-Drop | @dnd-kit |
| Charts | Recharts |
| Icons | Lucide, Phosphor Icons |

---

## Feature Count Summary

| Category | Features |
|----------|----------|
| Authentication | 10 |
| Organization | 15 |
| Projects | 25 |
| Tasks | 20 |
| Workstreams | 8 |
| Clients | 12 |
| Files | 15 |
| Notes | 15 |
| AI | 12 |
| Real-time | 7 |
| Settings | 8 |
| UI/UX | 20+ |
| **Total** | **~170+** |
