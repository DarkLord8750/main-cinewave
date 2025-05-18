/*
  # Fix Content Editing Permissions

  1. Changes
    - Update RLS policies for content table
    - Add proper admin access policies
    - Fix content_genres policies
  
  2. Security
    - Maintain RLS protection
    - Ensure proper admin access
    - Fix permission issues for content editing
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can read content" ON content;
DROP POLICY IF EXISTS "Admin users can manage content" ON content;
DROP POLICY IF EXISTS "Anyone can read content_genres" ON content_genres;
DROP POLICY IF EXISTS "Admins can manage content_genres" ON content_genres;

-- Create new policies for content table
CREATE POLICY "enable_read_access_for_all_authenticated_users"
ON content
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "enable_full_access_for_admin_users"
ON content
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

-- Create new policies for content_genres table
CREATE POLICY "enable_read_access_for_content_genres"
ON content_genres
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "enable_write_access_for_admin_users"
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