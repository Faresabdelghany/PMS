-- Add context_window and cost columns to user_models
ALTER TABLE public.user_models
  ADD COLUMN IF NOT EXISTS context_window INTEGER,
  ADD COLUMN IF NOT EXISTS cost_input DECIMAL(10,4),
  ADD COLUMN IF NOT EXISTS cost_output DECIMAL(10,4);
