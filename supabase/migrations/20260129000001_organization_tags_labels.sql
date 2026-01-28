-- Organization Tags table (unified for projects and tasks)
CREATE TABLE organization_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT organization_tags_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  CONSTRAINT organization_tags_description_length CHECK (description IS NULL OR char_length(description) <= 200),
  UNIQUE(organization_id, name)
);

-- Organization Labels table (category-based for projects)
CREATE TABLE organization_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('type', 'duration', 'group', 'badge')),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT organization_labels_name_length CHECK (char_length(name) >= 1 AND char_length(name) <= 50),
  CONSTRAINT organization_labels_description_length CHECK (description IS NULL OR char_length(description) <= 200),
  UNIQUE(organization_id, category, name)
);

-- Indexes
CREATE INDEX idx_org_tags_org ON organization_tags(organization_id);
CREATE INDEX idx_org_labels_org ON organization_labels(organization_id);
CREATE INDEX idx_org_labels_category ON organization_labels(organization_id, category);

-- Enable RLS
ALTER TABLE organization_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization_tags
CREATE POLICY "Org members can view tags"
  ON organization_tags FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "Org members can create tags"
  ON organization_tags FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update tags"
  ON organization_tags FOR UPDATE
  TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can delete tags"
  ON organization_tags FOR DELETE
  TO authenticated
  USING (is_org_member(organization_id));

-- RLS Policies for organization_labels
CREATE POLICY "Org members can view labels"
  ON organization_labels FOR SELECT
  TO authenticated
  USING (is_org_member(organization_id));

CREATE POLICY "Org members can create labels"
  ON organization_labels FOR INSERT
  TO authenticated
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can update labels"
  ON organization_labels FOR UPDATE
  TO authenticated
  USING (is_org_member(organization_id))
  WITH CHECK (is_org_member(organization_id));

CREATE POLICY "Org members can delete labels"
  ON organization_labels FOR DELETE
  TO authenticated
  USING (is_org_member(organization_id));

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_organization_tags_updated_at
  BEFORE UPDATE ON organization_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_organization_labels_updated_at
  BEFORE UPDATE ON organization_labels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
