/*
  # Fix recursive users table policies

  1. Changes
    - Remove recursive admin check in users table policies
    - Simplify policy logic to prevent infinite recursion
    - Maintain security while allowing proper access

  2. Security
    - Users can still only read their own data
    - Admins maintain full access to all user data
    - Policies are more efficient and prevent recursion
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_all_admin" ON users;
DROP POLICY IF EXISTS "users_read_own" ON users;
DROP POLICY IF EXISTS "users_write_admin" ON users;

-- Create new non-recursive policies
CREATE POLICY "users_read_own"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "users_read_all_admin"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'is_admin' = 'true'
  )
);

CREATE POLICY "users_write_admin"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'is_admin' = 'true'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND auth.users.raw_app_meta_data->>'is_admin' = 'true'
  )
);