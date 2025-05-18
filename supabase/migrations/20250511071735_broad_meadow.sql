/*
  # Add RLS policies for content_genres table

  1. Security Changes
    - Add RLS policies for content_genres table to allow:
      - Admin users to have full access (ALL operations)
      - Authenticated users to have read-only access
*/

-- Enable RLS for content_genres table (if not already enabled)
ALTER TABLE content_genres ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read content_genres" ON content_genres;
DROP POLICY IF EXISTS "Admins can manage content_genres" ON content_genres;

-- Add policy for read access for all authenticated users
CREATE POLICY "Anyone can read content_genres"
ON content_genres
FOR SELECT
TO authenticated
USING (true);

-- Add policy for full access for admin users
CREATE POLICY "Admins can manage content_genres"
ON content_genres
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.is_admin = true
  )
);