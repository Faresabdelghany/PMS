-- ============================================
-- Add UPDATE Policy for Chat Messages
-- Migration: 20260131000003_add_chat_messages_update_policy
-- ============================================
-- Fixes missing UPDATE RLS policy that prevents updating action_data
-- when users confirm AI-proposed actions.

-- Users can update messages in their own conversations
CREATE POLICY "Users can update messages in own conversations"
  ON chat_messages FOR UPDATE
  USING (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  );
