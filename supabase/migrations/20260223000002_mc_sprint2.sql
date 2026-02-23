-- Mission Control Sprint 2: Board Groups, Board Webhooks, Custom Fields

-- ── Board Groups ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE board_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "board_groups_all" ON board_groups FOR ALL
    USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add board_group_id to boards table
ALTER TABLE boards ADD COLUMN IF NOT EXISTS board_group_id UUID REFERENCES board_groups(id) ON DELETE SET NULL;

-- ── Board Webhooks ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS board_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT ARRAY['task.created','task.updated','task.completed'],
  secret TEXT,
  enabled BOOLEAN DEFAULT true NOT NULL,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE board_webhooks ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "board_webhooks_all" ON board_webhooks FOR ALL
    USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Custom Field Definitions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE, -- NULL = global
  name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text','number','date','select','checkbox','url')),
  options JSONB, -- for select type: ["Option A", "Option B"]
  required BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE custom_field_definitions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "custom_fields_all" ON custom_field_definitions FOR ALL
    USING (org_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Custom Field Values ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_field_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id UUID NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  board_id UUID REFERENCES boards(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
ALTER TABLE custom_field_values ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "custom_field_values_all" ON custom_field_values FOR ALL
    USING (field_id IN (SELECT id FROM custom_field_definitions WHERE org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
