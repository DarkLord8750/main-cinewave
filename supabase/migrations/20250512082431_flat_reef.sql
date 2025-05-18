/*
  # Fix Users Table Policies

  1. Changes
    - Remove existing policies that may cause recursion
    - Create new, simplified policies for users table:
      - Admin users can access everything
      - Regular users can only read their own data
      
  2. Security
    - Maintains RLS protection
    - Prevents infinite recursion in policies
    - Ensures proper access control
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "allow_admin_full_access" ON users;
DROP POLICY IF EXISTS "allow_users_read_own" ON users;

-- Create new, simplified policies
CREATE POLICY "admin_full_access"
ON users
FOR ALL
TO authenticated
USING (
  is_admin = true
)
WITH CHECK (
  is_admin = true
);

CREATE POLICY "users_read_own"
ON users
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
);