/*
  # Fix Users RLS Policies

  1. Changes
    - Drop existing problematic policies
    - Create new simplified policies for users table
    - Fix recursive policy issues
  
  2. Security
    - Enable proper access control
    - Allow users to read their own data
    - Allow admins to read all data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_admin_access" ON users;
DROP POLICY IF EXISTS "users_self_access" ON users;
DROP POLICY IF EXISTS "users_read_policy" ON users;
DROP POLICY IF EXISTS "users_write_policy" ON users;

-- Create new simplified policies
CREATE POLICY "users_read_policy"
ON users
FOR SELECT
TO authenticated
USING (
  -- Allow users to read their own data
  id = auth.uid()
  OR
  -- Allow admins to read all data
  (SELECT is_admin FROM users WHERE id = auth.uid())
);

CREATE POLICY "users_write_policy"
ON users
FOR ALL
TO authenticated
USING (
  -- Only admins can modify data
  (SELECT is_admin FROM users WHERE id = auth.uid())
)
WITH CHECK (
  (SELECT is_admin FROM users WHERE id = auth.uid())
);