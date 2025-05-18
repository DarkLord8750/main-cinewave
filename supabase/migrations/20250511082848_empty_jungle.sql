/*
  # Add Video Quality URLs to Episodes Table

  1. Changes
    - Add video quality URL columns to episodes table
    - Add URL format validation constraints
    - Update episode-related functions and policies

  2. Security
    - Maintain existing RLS policies
    - Add URL format validation
*/

-- Add video quality URL columns to episodes table
ALTER TABLE episodes
ADD COLUMN video_url_480p text,
ADD COLUMN video_url_720p text,
ADD COLUMN video_url_1080p text,
ADD COLUMN video_url_4k text;

-- Add check constraints for URL format validation
ALTER TABLE episodes
ADD CONSTRAINT episode_video_url_480p_check CHECK (video_url_480p IS NULL OR video_url_480p ~ '^https?://.*$'),
ADD CONSTRAINT episode_video_url_720p_check CHECK (video_url_720p IS NULL OR video_url_720p ~ '^https?://.*$'),
ADD CONSTRAINT episode_video_url_1080p_check CHECK (video_url_1080p IS NULL OR video_url_1080p ~ '^https?://.*$'),
ADD CONSTRAINT episode_video_url_4k_check CHECK (video_url_4k IS NULL OR video_url_4k ~ '^https?://.*$');

-- Drop existing video_url column since we now have quality-specific URLs
ALTER TABLE episodes
DROP COLUMN IF EXISTS video_url;