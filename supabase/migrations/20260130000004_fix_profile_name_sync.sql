-- Fix handle_user_update trigger to not overwrite user-edited full_name
--
-- Problem: The COALESCE order was prioritizing OAuth metadata over user edits.
-- When a user updates their full_name in the profiles table, the trigger would
-- overwrite it with the OAuth provider's name on any auth.users update.
--
-- Solution: Reverse COALESCE order to preserve existing profile values.
-- Only use OAuth metadata as a fallback when profile value is NULL.

CREATE OR REPLACE FUNCTION handle_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET
    email = NEW.email,
    -- Preserve existing full_name if set, only fall back to OAuth metadata if NULL
    full_name = COALESCE(public.profiles.full_name, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    -- Preserve existing avatar_url if set, only fall back to OAuth metadata if NULL
    avatar_url = COALESCE(public.profiles.avatar_url, NEW.raw_user_meta_data->>'avatar_url'),
    updated_at = now()
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;
