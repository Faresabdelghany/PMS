CREATE TABLE public.model_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  use_case text NOT NULL,
  user_model_id uuid REFERENCES public.user_models(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, use_case)
);
CREATE INDEX idx_model_assignments_org ON public.model_assignments(organization_id);
ALTER TABLE public.model_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_access" ON public.model_assignments FOR ALL USING (
  organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid())
);
