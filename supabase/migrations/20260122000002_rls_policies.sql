-- ============================================
-- PMS Row Level Security Policies
-- Migration: 002_rls_policies
-- ============================================

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Check if current user is a member of an organization
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is an admin of an organization
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is a member of a project
CREATE OR REPLACE FUNCTION is_project_member(proj_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = proj_id
    AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if current user is owner of a project
CREATE OR REPLACE FUNCTION is_project_owner(proj_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = proj_id
    AND user_id = auth.uid()
    AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get organization ID from a project
CREATE OR REPLACE FUNCTION get_project_org_id(proj_id UUID)
RETURNS UUID AS $$
  SELECT organization_id FROM projects WHERE id = proj_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- ENABLE RLS ON ALL TABLES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_scope ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workstreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can read profiles of people in their organizations
CREATE POLICY "Users can read org member profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = auth.uid()
      AND om2.user_id = profiles.id
    )
  );

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- ORGANIZATIONS POLICIES
-- ============================================

-- Members can view their organizations
CREATE POLICY "Members can view organization"
  ON organizations FOR SELECT
  USING (is_org_member(id));

-- Authenticated users can create organizations
CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Admins can update organizations
CREATE POLICY "Admins can update organization"
  ON organizations FOR UPDATE
  USING (is_org_admin(id))
  WITH CHECK (is_org_admin(id));

-- Admins can delete organizations
CREATE POLICY "Admins can delete organization"
  ON organizations FOR DELETE
  USING (is_org_admin(id));

-- ============================================
-- ORGANIZATION MEMBERS POLICIES
-- ============================================

-- Members can view other members in their org
CREATE POLICY "Members can view org members"
  ON organization_members FOR SELECT
  USING (is_org_member(organization_id));

-- Admins can add members
CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (is_org_admin(organization_id) OR (
    -- Allow self-insert when creating org (first member)
    user_id = auth.uid() AND role = 'admin' AND NOT EXISTS (
      SELECT 1 FROM organization_members WHERE organization_id = organization_members.organization_id
    )
  ));

-- Admins can update member roles
CREATE POLICY "Admins can update members"
  ON organization_members FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- Admins can remove members
CREATE POLICY "Admins can remove members"
  ON organization_members FOR DELETE
  USING (is_org_admin(organization_id));

-- ============================================
-- TEAMS POLICIES
-- ============================================

-- Org members can view teams
CREATE POLICY "Org members can view teams"
  ON teams FOR SELECT
  USING (is_org_member(organization_id));

-- Org admins can manage teams
CREATE POLICY "Admins can create teams"
  ON teams FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Admins can update teams"
  ON teams FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

CREATE POLICY "Admins can delete teams"
  ON teams FOR DELETE
  USING (is_org_admin(organization_id));

-- ============================================
-- INVITATIONS POLICIES
-- ============================================

-- Admins can view invitations
CREATE POLICY "Admins can view invitations"
  ON invitations FOR SELECT
  USING (is_org_admin(organization_id));

-- Users can view invitations sent to their email
CREATE POLICY "Users can view own invitations"
  ON invitations FOR SELECT
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Admins can create invitations
CREATE POLICY "Admins can create invitations"
  ON invitations FOR INSERT
  WITH CHECK (is_org_admin(organization_id));

-- Admins can update/cancel invitations
CREATE POLICY "Admins can update invitations"
  ON invitations FOR UPDATE
  USING (is_org_admin(organization_id))
  WITH CHECK (is_org_admin(organization_id));

-- Anyone can update invitation to accept (with valid token)
CREATE POLICY "Users can accept invitations"
  ON invitations FOR UPDATE
  USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()) AND status = 'pending')
  WITH CHECK (status = 'accepted');

CREATE POLICY "Admins can delete invitations"
  ON invitations FOR DELETE
  USING (is_org_admin(organization_id));

-- ============================================
-- CLIENTS POLICIES
-- ============================================

-- Org members can view clients
CREATE POLICY "Org members can view clients"
  ON clients FOR SELECT
  USING (is_org_member(organization_id));

-- Org members can create clients
CREATE POLICY "Org members can create clients"
  ON clients FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- Org members can update clients
CREATE POLICY "Org members can update clients"
  ON clients FOR UPDATE
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

-- Org admins can delete clients
CREATE POLICY "Admins can delete clients"
  ON clients FOR DELETE
  USING (is_org_admin(organization_id));

-- ============================================
-- PROJECTS POLICIES
-- ============================================

-- Org members can view projects
CREATE POLICY "Org members can view projects"
  ON projects FOR SELECT
  USING (is_org_member(organization_id));

-- Org members can create projects
CREATE POLICY "Org members can create projects"
  ON projects FOR INSERT
  WITH CHECK (is_org_member(organization_id));

-- Project members can update projects
CREATE POLICY "Project members can update projects"
  ON projects FOR UPDATE
  USING (is_project_member(id) OR is_org_admin(organization_id))
  WITH CHECK (is_project_member(id) OR is_org_admin(organization_id));

-- Project owners or org admins can delete projects
CREATE POLICY "Owners can delete projects"
  ON projects FOR DELETE
  USING (is_project_owner(id) OR is_org_admin(organization_id));

-- ============================================
-- PROJECT MEMBERS POLICIES
-- ============================================

-- Org members can view project members
CREATE POLICY "Org members can view project members"
  ON project_members FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));

-- Project owners can manage project members
CREATE POLICY "Project owners can add members"
  ON project_members FOR INSERT
  WITH CHECK (
    is_project_owner(project_id) OR
    is_org_admin(get_project_org_id(project_id)) OR
    -- Allow creator to add themselves as owner
    (user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Project owners can update members"
  ON project_members FOR UPDATE
  USING (is_project_owner(project_id) OR is_org_admin(get_project_org_id(project_id)))
  WITH CHECK (is_project_owner(project_id) OR is_org_admin(get_project_org_id(project_id)));

CREATE POLICY "Project owners can remove members"
  ON project_members FOR DELETE
  USING (is_project_owner(project_id) OR is_org_admin(get_project_org_id(project_id)));

-- ============================================
-- PROJECT DETAILS POLICIES (scope, outcomes, features, deliverables, metrics)
-- ============================================

-- These all follow the same pattern: org members can read, project members can write

-- Project Scope
CREATE POLICY "Org members can view scope" ON project_scope FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can insert scope" ON project_scope FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update scope" ON project_scope FOR UPDATE
  USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete scope" ON project_scope FOR DELETE
  USING (is_project_member(project_id));

-- Project Outcomes
CREATE POLICY "Org members can view outcomes" ON project_outcomes FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can insert outcomes" ON project_outcomes FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update outcomes" ON project_outcomes FOR UPDATE
  USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete outcomes" ON project_outcomes FOR DELETE
  USING (is_project_member(project_id));

-- Project Features
CREATE POLICY "Org members can view features" ON project_features FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can insert features" ON project_features FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update features" ON project_features FOR UPDATE
  USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete features" ON project_features FOR DELETE
  USING (is_project_member(project_id));

-- Project Deliverables
CREATE POLICY "Org members can view deliverables" ON project_deliverables FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can insert deliverables" ON project_deliverables FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update deliverables" ON project_deliverables FOR UPDATE
  USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete deliverables" ON project_deliverables FOR DELETE
  USING (is_project_member(project_id));

-- Project Metrics
CREATE POLICY "Org members can view metrics" ON project_metrics FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can insert metrics" ON project_metrics FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update metrics" ON project_metrics FOR UPDATE
  USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete metrics" ON project_metrics FOR DELETE
  USING (is_project_member(project_id));

-- ============================================
-- WORKSTREAMS POLICIES
-- ============================================

CREATE POLICY "Org members can view workstreams" ON workstreams FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can create workstreams" ON workstreams FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update workstreams" ON workstreams FOR UPDATE
  USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete workstreams" ON workstreams FOR DELETE
  USING (is_project_member(project_id));

-- ============================================
-- TASKS POLICIES
-- ============================================

CREATE POLICY "Org members can view tasks" ON tasks FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can create tasks" ON tasks FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can update tasks" ON tasks FOR UPDATE
  USING (is_project_member(project_id)) WITH CHECK (is_project_member(project_id));
CREATE POLICY "Project members can delete tasks" ON tasks FOR DELETE
  USING (is_project_member(project_id));

-- ============================================
-- PROJECT FILES POLICIES
-- ============================================

CREATE POLICY "Org members can view files" ON project_files FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can upload files" ON project_files FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "File owners can update files" ON project_files FOR UPDATE
  USING (added_by_id = auth.uid() OR is_org_admin(get_project_org_id(project_id)))
  WITH CHECK (added_by_id = auth.uid() OR is_org_admin(get_project_org_id(project_id)));
CREATE POLICY "File owners can delete files" ON project_files FOR DELETE
  USING (added_by_id = auth.uid() OR is_org_admin(get_project_org_id(project_id)));

-- ============================================
-- PROJECT NOTES POLICIES
-- ============================================

CREATE POLICY "Org members can view notes" ON project_notes FOR SELECT
  USING (is_org_member(get_project_org_id(project_id)));
CREATE POLICY "Project members can create notes" ON project_notes FOR INSERT
  WITH CHECK (is_project_member(project_id));
CREATE POLICY "Note owners can update notes" ON project_notes FOR UPDATE
  USING (added_by_id = auth.uid() OR is_org_admin(get_project_org_id(project_id)))
  WITH CHECK (added_by_id = auth.uid() OR is_org_admin(get_project_org_id(project_id)));
CREATE POLICY "Note owners can delete notes" ON project_notes FOR DELETE
  USING (added_by_id = auth.uid() OR is_org_admin(get_project_org_id(project_id)));

-- ============================================
-- USER SETTINGS POLICIES
-- ============================================

CREATE POLICY "Users can view own settings" ON user_settings FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Users can create own settings" ON user_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own settings" ON user_settings FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own settings" ON user_settings FOR DELETE
  USING (user_id = auth.uid());
