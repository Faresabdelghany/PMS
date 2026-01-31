-- ============================================
-- Fix search_path for chat functions
-- Migration: 20260131000002_fix_chat_function_search_paths
-- ============================================

-- Update update_conversation_on_message with fixed search_path
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update auto_generate_conversation_title with fixed search_path
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
  FROM public.chat_conversations
  WHERE id = NEW.conversation_id;

  -- Only update if title is still the default
  IF current_title = 'New Chat' THEN
    -- Truncate content to 80 chars for title
    new_title := LEFT(TRIM(NEW.content), 80);

    -- Add ellipsis if truncated
    IF LENGTH(TRIM(NEW.content)) > 80 THEN
      new_title := new_title || '...';
    END IF;

    UPDATE public.chat_conversations
    SET title = new_title
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
