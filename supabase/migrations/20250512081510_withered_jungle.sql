/*
  # Fix User Access Policies

  1. Changes
    - Drop existing problematic policies
    - Create new simplified policies that allow:
      - Admin users to see and manage all users
      - Regular users to see only their own data
    
  2. Security
    - Maintain RLS protection
    - Ensure proper access control
*/

-- Drop existing policies
DROP POLICY IF EXISTS "enable_self_access" ON users;
DROP POLICY IF EXISTS "enable_admin_access" ON users;
DROP POLICY IF EXISTS "users_self_access" ON users;
DROP POLICY IF EXISTS "users_admin_access" ON users;

-- Create new simplified policies
CREATE POLICY "allow_admin_full_access"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND is_admin = true
  )
);

CREATE POLICY "allow_users_read_own"
ON users
FOR SELECT
TO authenticated
USING (id = auth.uid());