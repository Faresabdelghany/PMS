-- ============================================
-- Chat Conversations & Messages
-- Migration: 20260131000001_chat_conversations
-- ============================================
-- Adds tables for persisting AI chat conversations

-- ============================================
-- TABLES
-- ============================================

-- Chat Conversations
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Chat Messages
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES chat_conversations ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB DEFAULT NULL,
  action_data JSONB DEFAULT NULL,
  multi_action_data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================

-- Chat Conversations: query by user within org, ordered by most recent
CREATE INDEX idx_chat_conversations_user_org_updated
  ON chat_conversations(user_id, organization_id, updated_at DESC);

-- Chat Messages: query by conversation, ordered chronologically
CREATE INDEX idx_chat_messages_conversation_created
  ON chat_messages(conversation_id, created_at ASC);

-- ============================================
-- TRIGGERS
-- ============================================

-- Apply updated_at trigger to chat_conversations
CREATE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update conversation updated_at when a message is inserted
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation updated_at on new message
CREATE TRIGGER update_conversation_on_new_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_on_message();

-- Function to auto-generate conversation title from first user message
CREATE OR REPLACE FUNCTION auto_generate_conversation_title()
RETURNS TRIGGER AS $$
DECLARE
  current_title TEXT;
  new_title TEXT;
BEGIN
  -- Only process user messages
  IF NEW.role != 'user' THEN
    RETURN NEW;
  END IF;

  -- Get current conversation title
  SELECT title INTO current_title
  FROM chat_conversations
  WHERE id = NEW.conversation_id;

  -- Only update if title is still the default
  IF current_title = 'New Chat' THEN
    -- Truncate content to 80 chars for title
    new_title := LEFT(TRIM(NEW.content), 80);

    -- Add ellipsis if truncated
    IF LENGTH(TRIM(NEW.content)) > 80 THEN
      new_title := new_title || '...';
    END IF;

    UPDATE chat_conversations
    SET title = new_title
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate title on first user message
CREATE TRIGGER auto_generate_title_on_first_message
  AFTER INSERT ON chat_messages
  FOR EACH ROW EXECUTE FUNCTION auto_generate_conversation_title();

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Chat Conversations Policies

-- Users can read their own conversations
CREATE POLICY "Users can read own conversations"
  ON chat_conversations FOR SELECT
  USING (user_id = auth.uid());

-- Users can create their own conversations
CREATE POLICY "Users can create own conversations"
  ON chat_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
  ON chat_conversations FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
  ON chat_conversations FOR DELETE
  USING (user_id = auth.uid());

-- Chat Messages Policies

-- Users can read messages from their own conversations
CREATE POLICY "Users can read messages from own conversations"
  ON chat_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  );

-- Users can insert messages into their own conversations
CREATE POLICY "Users can insert messages into own conversations"
  ON chat_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  );

-- Users can delete messages from their own conversations
CREATE POLICY "Users can delete messages from own conversations"
  ON chat_messages FOR DELETE
  USING (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  );

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE chat_conversations IS 'Stores AI chat conversation metadata for users';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat conversations';
COMMENT ON COLUMN chat_messages.attachments IS 'JSON array of {name, type, extractedText} for file attachments';
COMMENT ON COLUMN chat_messages.action_data IS 'Stores the proposed/executed action state for single actions';
COMMENT ON COLUMN chat_messages.multi_action_data IS 'Stores multi-action execution state';
