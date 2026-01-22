-- ============================================
-- PMS Storage Buckets
-- Migration: 003_storage
-- ============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('project-files', 'project-files', false, 52428800, -- 50MB
    ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/zip', 'application/x-zip-compressed']),
  ('project-images', 'project-images', false, 10485760, -- 10MB
    ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']),
  ('project-media', 'project-media', false, 104857600, -- 100MB
    ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm', 'video/mp4', 'video/webm']),
  ('avatars', 'avatars', true, 2097152, -- 2MB
    ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('org-logos', 'org-logos', true, 5242880, -- 5MB
    ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- HELPER FUNCTIONS (in public schema)
-- ============================================

-- Helper function to get org_id from storage path
-- Path format: {org_id}/{project_id}/{filename}
CREATE OR REPLACE FUNCTION public.get_org_id_from_path(path TEXT)
RETURNS UUID AS $$
BEGIN
  RETURN (string_to_array(path, '/'))[1]::UUID;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user can access org storage
CREATE OR REPLACE FUNCTION public.can_access_org_storage(path TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  org_id UUID;
BEGIN
  org_id := public.get_org_id_from_path(path);
  IF org_id IS NULL THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = org_id
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- PROJECT FILES BUCKET POLICIES
-- ============================================

-- Org members can read project files
CREATE POLICY "Org members can read project files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files' AND
  public.can_access_org_storage(name)
);

-- Org members can upload project files
CREATE POLICY "Org members can upload project files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files' AND
  public.can_access_org_storage(name)
);

-- File uploaders can update their files
CREATE POLICY "Users can update own project files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-files' AND
  owner_id::uuid = auth.uid()
)
WITH CHECK (
  bucket_id = 'project-files' AND
  owner_id::uuid = auth.uid()
);

-- File uploaders or org admins can delete files
CREATE POLICY "Users can delete own project files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-files' AND
  (owner_id::uuid = auth.uid() OR public.can_access_org_storage(name))
);

-- ============================================
-- PROJECT IMAGES BUCKET POLICIES
-- ============================================

CREATE POLICY "Org members can read project images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-images' AND
  public.can_access_org_storage(name)
);

CREATE POLICY "Org members can upload project images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-images' AND
  public.can_access_org_storage(name)
);

CREATE POLICY "Users can update own project images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-images' AND owner_id::uuid = auth.uid())
WITH CHECK (bucket_id = 'project-images' AND owner_id::uuid = auth.uid());

CREATE POLICY "Users can delete own project images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-images' AND
  (owner_id::uuid = auth.uid() OR public.can_access_org_storage(name))
);

-- ============================================
-- PROJECT MEDIA BUCKET POLICIES
-- ============================================

CREATE POLICY "Org members can read project media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-media' AND
  public.can_access_org_storage(name)
);

CREATE POLICY "Org members can upload project media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-media' AND
  public.can_access_org_storage(name)
);

CREATE POLICY "Users can update own project media"
ON storage.objects FOR UPDATE
USING (bucket_id = 'project-media' AND owner_id::uuid = auth.uid())
WITH CHECK (bucket_id = 'project-media' AND owner_id::uuid = auth.uid());

CREATE POLICY "Users can delete own project media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-media' AND
  (owner_id::uuid = auth.uid() OR public.can_access_org_storage(name))
);

-- ============================================
-- AVATARS BUCKET POLICIES (PUBLIC)
-- ============================================

-- Anyone can read avatars (public bucket)
CREATE POLICY "Anyone can read avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Authenticated users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::TEXT
);

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::TEXT
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::TEXT
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::TEXT
);

-- ============================================
-- ORG LOGOS BUCKET POLICIES (PUBLIC)
-- ============================================

-- Anyone can read org logos (public bucket)
CREATE POLICY "Anyone can read org logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'org-logos');

-- Org admins can upload org logo
CREATE POLICY "Admins can upload org logo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'org-logos' AND
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = (storage.foldername(name))[1]::UUID
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Org admins can update org logo
CREATE POLICY "Admins can update org logo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'org-logos' AND
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = (storage.foldername(name))[1]::UUID
    AND user_id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  bucket_id = 'org-logos' AND
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = (storage.foldername(name))[1]::UUID
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);

-- Org admins can delete org logo
CREATE POLICY "Admins can delete org logo"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'org-logos' AND
  EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_id = (storage.foldername(name))[1]::UUID
    AND user_id = auth.uid()
    AND role = 'admin'
  )
);
