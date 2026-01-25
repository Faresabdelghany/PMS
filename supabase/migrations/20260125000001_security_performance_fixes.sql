-- ============================================
-- PMS Security & Performance Fixes
-- Migration: 004_security_performance_fixes
-- ============================================
-- Fixes:
-- 1. Function search_path security issues (10 functions)
-- 2. RLS policies re-evaluating auth.uid() per row
-- 3. Missing foreign key indexes
-- 4. Multiple permissive policies consolidation

-- ============================================
-- 1. FIX FUNCTION SEARCH_PATH ISSUES
-- ============================================

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Fix handle_user_update
CREATE OR REPLACE FUNCTION handle_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', public.profiles.full_name),
    avatar_url = COALESCE(NEW.raw_user_meta_data->>'avatar_url', public.profiles.avatar_url),
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Fix is_org_member
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
$$;

-- Fix is_org_admin
CREATE OR REPLACE FUNCTION is_org_admin(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Fix is_project_member
CREATE OR REPLACE FUNCTION is_project_member(proj_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = proj_id
    AND user_id = auth.uid()
  );
$$;

-- Fix is_project_owner
CREATE OR REPLACE FUNCTION is_project_owner(proj_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE project_id = proj_id
    AND user_id = auth.uid()
    AND role = 'owner'
  );
$$;

-- Fix get_project_org_id
CREATE OR REPLACE FUNCTION get_project_org_id(proj_id UUID)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT organization_id FROM public.projects WHERE id = proj_id;
$$;

-- Fix get_org_id_from_path (storage helper)
CREATE OR REPLACE FUNCTION public.get_org_id_from_path(path TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN (string_to_array(path, '/'))[1]::UUID;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$;

-- Fix can_access_org_storage (storage helper)
CREATE OR REPLACE FUNCTION public.can_access_org_storage(path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  org_id UUID;
BEGIN
  org_id := public.get_org_id_from_path(path);
  IF org_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$;

-- ============================================
-- 2. FIX RLS POLICIES (use select auth.uid())
-- ============================================

-- Drop and recreate affected policies with optimized auth.uid() calls

-- PROFILES policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read org member profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Consolidated profile SELECT policy (fixes multiple permissive policies issue too)
CREATE POLICY "Users can read profiles"
  ON profiles FOR SELECT
  USING (
    id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members om1
      JOIN organization_members om2 ON om1.organization_id = om2.organization_id
      WHERE om1.user_id = (SELECT auth.uid())
      AND om2.user_id = profiles.id
    )
  );

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ORGANIZATIONS policies
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;

CREATE POLICY "Users can create organizations"
  ON organizations FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

-- ORGANIZATION_MEMBERS policies
DROP POLICY IF EXISTS "Admins can add members" ON organization_members;

CREATE POLICY "Admins can add members"
  ON organization_members FOR INSERT
  WITH CHECK (
    is_org_admin(organization_id) OR (
      -- Allow self-insert when creating org (first member)
      user_id = (SELECT auth.uid()) AND role = 'admin' AND NOT EXISTS (
        SELECT 1 FROM organization_members om WHERE om.organization_id = organization_members.organization_id
      )
    )
  );

-- INVITATIONS policies
DROP POLICY IF EXISTS "Admins can view invitations" ON invitations;
DROP POLICY IF EXISTS "Users can view own invitations" ON invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON invitations;
DROP POLICY IF EXISTS "Users can accept invitations" ON invitations;

-- Consolidated invitation SELECT policy
CREATE POLICY "Users can view invitations"
  ON invitations FOR SELECT
  USING (
    is_org_admin(organization_id)
    OR email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
  );

-- Consolidated UPDATE policy (combines admin updates and user accepts)
CREATE POLICY "Users can update invitations"
  ON invitations FOR UPDATE
  USING (
    -- Admins can update any invitation in their org
    is_org_admin(organization_id)
    OR (
      -- Users can accept their own pending invitations
      email = (SELECT email FROM auth.users WHERE id = (SELECT auth.uid()))
      AND status = 'pending'
    )
  )
  WITH CHECK (
    -- Admins can set any status
    is_org_admin(organization_id)
    OR (
      -- Non-admins can only set status to 'accepted'
      status = 'accepted'
    )
  );

-- PROJECT_MEMBERS policies
DROP POLICY IF EXISTS "Project owners can add members" ON project_members;

CREATE POLICY "Project owners can add members"
  ON project_members FOR INSERT
  WITH CHECK (
    is_project_owner(project_id) OR
    is_org_admin(get_project_org_id(project_id)) OR
    -- Allow creator to add themselves as owner
    (user_id = (SELECT auth.uid()) AND role = 'owner')
  );

-- PROJECT_FILES policies
DROP POLICY IF EXISTS "File owners can update files" ON project_files;
DROP POLICY IF EXISTS "File owners can delete files" ON project_files;

CREATE POLICY "File owners can update files"
  ON project_files FOR UPDATE
  USING (added_by_id = (SELECT auth.uid()) OR is_org_admin(get_project_org_id(project_id)))
  WITH CHECK (added_by_id = (SELECT auth.uid()) OR is_org_admin(get_project_org_id(project_id)));

CREATE POLICY "File owners can delete files"
  ON project_files FOR DELETE
  USING (added_by_id = (SELECT auth.uid()) OR is_org_admin(get_project_org_id(project_id)));

-- PROJECT_NOTES policies
DROP POLICY IF EXISTS "Note owners can update notes" ON project_notes;
DROP POLICY IF EXISTS "Note owners can delete notes" ON project_notes;

CREATE POLICY "Note owners can update notes"
  ON project_notes FOR UPDATE
  USING (added_by_id = (SELECT auth.uid()) OR is_org_admin(get_project_org_id(project_id)))
  WITH CHECK (added_by_id = (SELECT auth.uid()) OR is_org_admin(get_project_org_id(project_id)));

CREATE POLICY "Note owners can delete notes"
  ON project_notes FOR DELETE
  USING (added_by_id = (SELECT auth.uid()) OR is_org_admin(get_project_org_id(project_id)));

-- USER_SETTINGS policies
DROP POLICY IF EXISTS "Users can view own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can create own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_settings;
DROP POLICY IF EXISTS "Users can delete own settings" ON user_settings;

CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can create own settings"
  ON user_settings FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can delete own settings"
  ON user_settings FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- 3. ADD MISSING FOREIGN KEY INDEXES
-- ============================================

-- clients.owner_id
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_id);

-- invitations.invited_by_id
CREATE INDEX IF NOT EXISTS idx_invitations_invited_by ON invitations(invited_by_id);

-- project_deliverables.project_id
CREATE INDEX IF NOT EXISTS idx_project_deliverables_project ON project_deliverables(project_id);

-- project_features.project_id
CREATE INDEX IF NOT EXISTS idx_project_features_project ON project_features(project_id);

-- project_files.added_by_id
CREATE INDEX IF NOT EXISTS idx_project_files_added_by ON project_files(added_by_id);

-- project_metrics.project_id
CREATE INDEX IF NOT EXISTS idx_project_metrics_project ON project_metrics(project_id);

-- project_notes.added_by_id
CREATE INDEX IF NOT EXISTS idx_project_notes_added_by ON project_notes(added_by_id);

-- project_outcomes.project_id
CREATE INDEX IF NOT EXISTS idx_project_outcomes_project ON project_outcomes(project_id);

-- project_scope.project_id
CREATE INDEX IF NOT EXISTS idx_project_scope_project ON project_scope(project_id);

-- ============================================
-- 4. NOTES
-- ============================================
-- The "multiple permissive policies" issue for invitations and profiles
-- has been addressed by consolidating policies above.
--
-- Leaked password protection must be enabled in Supabase Dashboard:
-- Authentication > Settings > Enable "Leaked Password Protection"
-- See: https://supabase.com/docs/guides/auth/password-security
