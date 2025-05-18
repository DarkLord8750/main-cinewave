/*
  # Add Watch History Table and Functions

  1. New Tables
    - `watch_history`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, references profiles)
      - `content_id` (uuid, references content)
      - `watch_time` (integer)
      - `completed` (boolean)
      - `last_watched` (timestamp)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Add policies for user access
    - Add function for updating watch history
*/

-- Drop existing objects if they exist
DROP FUNCTION IF EXISTS update_watch_history(uuid, uuid, integer, boolean);
DROP TABLE IF EXISTS watch_history CASCADE;

-- Create watch_history table
CREATE TABLE watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content_id uuid REFERENCES content(id) ON DELETE CASCADE,
  watch_time integer DEFAULT 0,
  completed boolean DEFAULT false,
  last_watched timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, content_id)
);

-- Enable RLS
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

-- Create policies for watch_history
CREATE POLICY "watch_history_read_policy"
  ON watch_history
  FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "watch_history_write_policy"
  ON watch_history
  FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Add indexes for better performance
CREATE INDEX idx_watch_history_profile_last_watched 
ON watch_history (profile_id, last_watched DESC);

CREATE INDEX idx_watch_history_content 
ON watch_history (content_id);

-- Function to update watch history
CREATE FUNCTION update_watch_history(
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