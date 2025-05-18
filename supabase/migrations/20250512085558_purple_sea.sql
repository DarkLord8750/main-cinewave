/*
  # Fix recursive users policy

  1. Changes
    - Remove recursive policy for users table
    - Add new non-recursive policies for admin and self access
    
  2. Security
    - Maintain admin access to all users
    - Allow users to read their own data
    - Prevent infinite recursion in policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_admin_access" ON users;
DROP POLICY IF EXISTS "users_read_own_data" ON users;

-- Create new non-recursive admin policy using auth.uid() directly
CREATE POLICY "users_admin_access" ON users
  FOR ALL 
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'is_admin' = 'true'
    )
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'authenticated' AND 
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_app_meta_data->>'is_admin' = 'true'
    )
  );

-- Create new policy for users to read their own data
CREATE POLICY "users_read_own_data" ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());