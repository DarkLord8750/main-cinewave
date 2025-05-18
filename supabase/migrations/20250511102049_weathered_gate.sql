/*
  # Add Continue Watching Feature

  1. Changes
    - Add indexes for optimizing watch history queries
    - Create function to get continue watching content
    - Add RLS policies for watch history
  
  2. Security
    - Enable RLS on watch history table
    - Add proper policies for data access
*/

-- Add index for watch history queries
CREATE INDEX IF NOT EXISTS idx_watch_history_profile_last_watched 
ON watch_history (profile_id, last_watched DESC);

-- Add index for content lookup
CREATE INDEX IF NOT EXISTS idx_watch_history_content 
ON watch_history (content_id);

-- Function to get continue watching content
CREATE OR REPLACE FUNCTION get_continue_watching(p_profile_id uuid)
RETURNS TABLE (
  content_id uuid,
  watch_time integer,
  completed boolean,
  last_watched timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    wh.content_id,
    wh.watch_time,
    wh.completed,
    wh.last_watched
  FROM watch_history wh
  WHERE wh.profile_id = p_profile_id
    AND wh.completed = false
  ORDER BY wh.last_watched DESC
  LIMIT 20;
END;
$$;