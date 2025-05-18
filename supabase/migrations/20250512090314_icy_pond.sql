/*
  # Fix Users Table RLS Policies

  1. Changes
    - Drop existing problematic policies
    - Create new simplified policies for users table
    - Avoid recursive checks in policy definitions
  
  2. Security
    - Maintain RLS protection
    - Allow users to read their own data
    - Allow admins to manage all users
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_read_own_record" ON users;
DROP POLICY IF EXISTS "users_admin_full_access" ON users;

-- Create new simplified policies
CREATE POLICY "users_read_own_data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "users_admin_access"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users
    WHERE auth.users.id = auth.uid()
    AND (auth.users.raw_app_meta_data->>'is_admin')::boolean = true
  )
);