-- Add color_theme column to user_settings table
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS color_theme TEXT DEFAULT 'default';

-- Add comment for the column
COMMENT ON COLUMN user_settings.color_theme IS 'User selected color theme (default, forest, ocean, sunset, etc.)';
