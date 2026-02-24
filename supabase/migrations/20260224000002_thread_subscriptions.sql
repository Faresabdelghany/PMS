-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Thread Subscriptions
-- Applies: 2026-02-24
-- IMPORTANT: Apply manually via Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- Create task_subscriptions table
CREATE TABLE IF NOT EXISTS public.task_subscriptions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          uuid        NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_id         uuid        NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  organization_id  uuid        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, agent_id)
);

-- Enable Row Level Security
ALTER TABLE public.task_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS policy: org members can view and manage their subscriptions
CREATE POLICY "org_members_can_manage_task_subscriptions"
  ON public.task_subscriptions
  FOR ALL
  USING (
    organization_id IN (
      SELECT organization_id
      FROM   public.organization_members
      WHERE  user_id = auth.uid()
    )
  );

-- Enable realtime updates for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_subscriptions;
