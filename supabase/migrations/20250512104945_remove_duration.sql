-- Add video quality URL columns to content table
ALTER TABLE content ADD COLUMN IF NOT EXISTS video_url_480p text;
ALTER TABLE content ADD COLUMN IF NOT EXISTS video_url_720p text;
ALTER TABLE content ADD COLUMN IF NOT EXISTS video_url_1080p text;
ALTER TABLE content ADD COLUMN IF NOT EXISTS video_url_4k text;

-- Remove duration column from content table as it's only relevant for episodes
ALTER TABLE content DROP COLUMN IF EXISTS duration; 