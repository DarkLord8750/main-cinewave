/*
  # Fix recursive users table policy

  1. Changes
    - Remove recursive policy for users table
    - Create new non-recursive policies for users table
    
  2. Security
    - Users can read their own data
    - Admins can read all user data
    - Admins can modify user data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_policy" ON users;
DROP POLICY IF EXISTS "users_write_policy" ON users;

-- Create new non-recursive read policy
CREATE POLICY "users_read_own_data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

-- Create separate admin read policy
CREATE POLICY "admin_read_all_users"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'is_admin' = 'true'
  )
);

-- Create admin write policy
CREATE POLICY "admin_manage_users"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'is_admin' = 'true'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'is_admin' = 'true'
  )
);