-- ============================================
-- PMS Database Schema
-- Migration: 001_initial_schema
-- ============================================

-- Note: Using gen_random_uuid() which is built into PostgreSQL 13+

-- ============================================
-- ENUMS
-- ============================================

-- Project enums
CREATE TYPE project_status AS ENUM ('backlog', 'planned', 'active', 'cancelled', 'completed');
CREATE TYPE project_priority AS ENUM ('urgent', 'high', 'medium', 'low');
CREATE TYPE project_intent AS ENUM ('delivery', 'experiment', 'internal');
CREATE TYPE success_type AS ENUM ('deliverable', 'metric', 'undefined');
CREATE TYPE deadline_type AS ENUM ('none', 'target', 'fixed');
CREATE TYPE work_structure AS ENUM ('linear', 'milestones', 'multistream');

-- Task enums
CREATE TYPE task_status AS ENUM ('todo', 'in-progress', 'done');
CREATE TYPE task_priority AS ENUM ('no-priority', 'low', 'medium', 'high', 'urgent');

-- Client enums
CREATE TYPE client_status AS ENUM ('prospect', 'active', 'on_hold', 'archived');

-- Role enums
CREATE TYPE org_member_role AS ENUM ('admin', 'member');
CREATE TYPE project_member_role AS ENUM ('owner', 'pic', 'member', 'viewer');

-- Other enums
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'cancelled', 'expired');
CREATE TYPE note_type AS ENUM ('general', 'meeting', 'audio');
CREATE TYPE note_status AS ENUM ('completed', 'processing');
CREATE TYPE file_type AS ENUM ('pdf', 'zip', 'fig', 'doc', 'file', 'image', 'video', 'audio');

-- ============================================
-- TABLES
-- ============================================

-- Profiles (synced from auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Organization Members
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  role org_member_role DEFAULT 'member' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(organization_id, user_id)
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Invitations
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  email TEXT NOT NULL,
  role org_member_role DEFAULT 'member' NOT NULL,
  token TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::TEXT,
  status invitation_status DEFAULT 'pending' NOT NULL,
  invited_by_id UUID REFERENCES profiles ON DELETE SET NULL,
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days') NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  status client_status DEFAULT 'prospect' NOT NULL,
  industry TEXT,
  website TEXT,
  location TEXT,
  owner_id UUID REFERENCES profiles ON DELETE SET NULL,
  primary_contact_name TEXT,
  primary_contact_email TEXT,
  segment TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  team_id UUID REFERENCES teams ON DELETE SET NULL,
  client_id UUID REFERENCES clients ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status project_status DEFAULT 'planned' NOT NULL,
  priority project_priority DEFAULT 'medium' NOT NULL,
  progress INTEGER DEFAULT 0 NOT NULL CHECK (progress >= 0 AND progress <= 100),
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
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Project Members
CREATE TABLE project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  role project_member_role DEFAULT 'member' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(project_id, user_id)
);

-- Project Scope
CREATE TABLE project_scope (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  item TEXT NOT NULL,
  is_in_scope BOOLEAN DEFAULT true NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Project Outcomes
CREATE TABLE project_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  item TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Project Features (P0, P1, P2)
CREATE TABLE project_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  item TEXT NOT NULL,
  priority INTEGER DEFAULT 1 NOT NULL CHECK (priority IN (0, 1, 2)),
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Project Deliverables
CREATE TABLE project_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Project Metrics
CREATE TABLE project_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  name TEXT NOT NULL,
  target TEXT,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Workstreams
CREATE TABLE workstreams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Tasks
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  workstream_id UUID REFERENCES workstreams ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  status task_status DEFAULT 'todo' NOT NULL,
  priority task_priority DEFAULT 'no-priority' NOT NULL,
  tag TEXT,
  assignee_id UUID REFERENCES profiles ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  sort_order INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Project Files
CREATE TABLE project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  name TEXT NOT NULL,
  file_type file_type DEFAULT 'file' NOT NULL,
  size_bytes BIGINT DEFAULT 0 NOT NULL,
  storage_path TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  is_link_asset BOOLEAN DEFAULT false NOT NULL,
  added_by_id UUID REFERENCES profiles ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Project Notes
CREATE TABLE project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  note_type note_type DEFAULT 'general' NOT NULL,
  status note_status DEFAULT 'completed' NOT NULL,
  added_by_id UUID REFERENCES profiles ON DELETE SET NULL,
  audio_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- User Settings (for AI API keys)
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE UNIQUE,
  ai_provider TEXT,
  ai_api_key_encrypted TEXT,
  ai_model_preference TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- Organization Members
CREATE INDEX idx_org_members_org ON organization_members(organization_id);
CREATE INDEX idx_org_members_user ON organization_members(user_id);

-- Teams
CREATE INDEX idx_teams_org ON teams(organization_id);

-- Invitations
CREATE INDEX idx_invitations_org ON invitations(organization_id);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_token ON invitations(token);

-- Clients
CREATE INDEX idx_clients_org ON clients(organization_id);
CREATE INDEX idx_clients_status ON clients(status);

-- Projects
CREATE INDEX idx_projects_org ON projects(organization_id);
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_team ON projects(team_id);
CREATE INDEX idx_projects_status ON projects(status);

-- Project Members
CREATE INDEX idx_project_members_project ON project_members(project_id);
CREATE INDEX idx_project_members_user ON project_members(user_id);

-- Workstreams
CREATE INDEX idx_workstreams_project ON workstreams(project_id);

-- Tasks
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_workstream ON tasks(workstream_id);
CREATE INDEX idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- Project Files
CREATE INDEX idx_files_project ON project_files(project_id);

-- Project Notes
CREATE INDEX idx_notes_project ON project_notes(project_id);

-- ============================================
-- TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workstreams_updated_at
  BEFORE UPDATE ON workstreams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON project_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PROFILE SYNC FROM AUTH.USERS
-- ============================================

-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync auth.users to profiles
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to update profile when auth user updates
CREATE OR REPLACE FUNCTION handle_user_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', profiles.full_name),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', profiles.avatar_url),
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update profile on auth user update
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_user_update();
