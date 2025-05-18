/*
  # Fix Watch History Function

  1. Changes
    - Drop existing function if it exists
    - Recreate function with updated logic
  
  2. Security
    - Maintain SECURITY DEFINER
    - Keep existing functionality
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_watch_history(uuid, uuid, integer, boolean);

-- Recreate the function
CREATE OR REPLACE FUNCTION update_watch_history(
  p_profile_id uuid,
  p_content_id uuid,
  p_watch_time integer,
  p_completed boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO watch_history (profile_id, content_id, watch_time, completed)
  VALUES (p_profile_id, p_content_id, p_watch_time, p_completed)
  ON CONFLICT (profile_id, content_id)
  DO UPDATE SET
    watch_time = p_watch_time,
    completed = p_completed,
    last_watched = now();
END;
$$;