-- Create inbox item type enum
CREATE TYPE inbox_item_type AS ENUM ('comment', 'task_update', 'client_update', 'project_milestone', 'system');

-- Create inbox_items table
CREATE TABLE inbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles ON DELETE SET NULL,
  item_type inbox_item_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false NOT NULL,
  project_id UUID REFERENCES projects ON DELETE CASCADE,
  task_id UUID REFERENCES tasks ON DELETE CASCADE,
  client_id UUID REFERENCES clients ON DELETE CASCADE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create indexes for common queries
CREATE INDEX idx_inbox_items_user_id ON inbox_items(user_id);
CREATE INDEX idx_inbox_items_organization_id ON inbox_items(organization_id);
CREATE INDEX idx_inbox_items_is_read ON inbox_items(user_id, is_read) WHERE is_read = false;
CREATE INDEX idx_inbox_items_created_at ON inbox_items(user_id, created_at DESC);
CREATE INDEX idx_inbox_items_item_type ON inbox_items(user_id, item_type);

-- Enable RLS
ALTER TABLE inbox_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can read their own inbox items
CREATE POLICY "Users can read own inbox items"
  ON inbox_items
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can update their own inbox items (mark as read)
CREATE POLICY "Users can update own inbox items"
  ON inbox_items
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own inbox items
CREATE POLICY "Users can delete own inbox items"
  ON inbox_items
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Org members can create inbox items for users in same org
CREATE POLICY "Org members can create inbox items"
  ON inbox_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_org_member(organization_id)
  );

-- Enable realtime for inbox_items
ALTER PUBLICATION supabase_realtime ADD TABLE inbox_items;
