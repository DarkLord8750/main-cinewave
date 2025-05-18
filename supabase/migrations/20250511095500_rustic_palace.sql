/*
  # Add User Features

  1. Changes
    - Add watch history table
    - Add profile avatars table
    - Update profiles table
    - Add functions for managing watch history
  
  2. Security
    - Enable RLS on new tables
    - Add policies for user data access
*/

-- Create profile_avatars table for pre-defined avatars
CREATE TABLE profile_avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  category text,
  created_at timestamptz DEFAULT now()
);

-- Add some default avatars
INSERT INTO profile_avatars (url, category) VALUES
  ('https://i.pravatar.cc/150?img=1', 'default'),
  ('https://i.pravatar.cc/150?img=2', 'default'),
  ('https://i.pravatar.cc/150?img=3', 'default'),
  ('https://i.pravatar.cc/150?img=4', 'default'),
  ('https://i.pravatar.cc/150?img=5', 'default'),
  ('https://i.pravatar.cc/150?img=6', 'default'),
  ('https://i.pravatar.cc/150?img=7', 'default'),
  ('https://i.pravatar.cc/150?img=8', 'default');

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
ALTER TABLE profile_avatars ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;

-- Create policies for profile_avatars
CREATE POLICY "Anyone can read profile avatars"
  ON profile_avatars
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for watch_history
CREATE POLICY "Users can read their own watch history"
  ON watch_history
  FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own watch history"
  ON watch_history
  FOR ALL
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = auth.uid()
  ));

-- Function to update watch history
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