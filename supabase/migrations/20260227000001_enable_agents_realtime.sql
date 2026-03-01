-- ============================================
-- Enable Realtime for Agents Table
-- Migration: enable_agents_realtime
-- ============================================

-- Add agents table to realtime publication for live updates
-- This enables real-time subscriptions to agent status changes, model updates, etc.
-- Uses idempotent DO blocks to avoid errors if tables are already in the publication.

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also add agent_activities for live activity feed
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_activities;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Also add agent_decisions for live decision tracking
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_decisions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
