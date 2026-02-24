-- User Models: multiple AI model configurations per organization
CREATE TABLE public.user_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  display_name text NOT NULL,
  provider text NOT NULL,
  model_id text NOT NULL,
  api_key_encrypted text,
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_models_org ON public.user_models(organization_id);

ALTER TABLE public.user_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access" ON public.user_models FOR ALL USING (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
  )
);
