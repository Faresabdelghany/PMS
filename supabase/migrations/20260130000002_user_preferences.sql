-- ============================================
-- User Preferences Extension
-- Migration: 20260130000002_user_preferences
-- ============================================

-- Add preference columns to user_settings
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'auto',
ADD COLUMN IF NOT EXISTS week_start_day TEXT DEFAULT 'monday' CHECK (week_start_day IN ('monday', 'sunday', 'saturday')),
ADD COLUMN IF NOT EXISTS open_links_in_app BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notifications_in_app BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notifications_email BOOLEAN DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN user_settings.timezone IS 'User timezone preference (auto, utc, or IANA timezone)';
COMMENT ON COLUMN user_settings.week_start_day IS 'First day of week for calendars';
COMMENT ON COLUMN user_settings.open_links_in_app IS 'Whether to open app links in the app';
COMMENT ON COLUMN user_settings.notifications_in_app IS 'Whether to receive in-app notifications';
COMMENT ON COLUMN user_settings.notifications_email IS 'Whether to receive email notifications';
