-- DoD enforce mode: add name column + delete RLS + override tracking

-- Add name column to done_policies
ALTER TABLE done_policies
  ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Unnamed Policy';

-- Add override columns to done_check_results for tracking overrides
ALTER TABLE done_check_results
  ADD COLUMN IF NOT EXISTS overridden BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS override_reason TEXT,
  ADD COLUMN IF NOT EXISTS overridden_by UUID REFERENCES auth.users(id);

-- DELETE RLS policy for done_policies (was missing from initial migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'done_policies' AND policyname = 'done_policies_delete'
  ) THEN
    CREATE POLICY "done_policies_delete" ON done_policies FOR DELETE
      USING (
        organization_id IN (
          SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
        )
      );
  END IF;
END $$;
