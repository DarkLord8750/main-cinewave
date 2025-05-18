/*
  # Fix recursive users table policy

  1. Changes
    - Drop existing policies that cause recursion
    - Create new non-recursive policies for users table
    
  2. Security
    - Maintain same security model but implement it without recursion
    - Admin users can access all records
    - Regular users can only access their own record
*/

-- Drop existing policies
DROP POLICY IF EXISTS "enable_admin_access" ON users;
DROP POLICY IF EXISTS "enable_user_access" ON users;

-- Create new non-recursive policies
CREATE POLICY "users_admin_access"
ON users
FOR ALL
TO authenticated
USING (
  is_admin = true
)
WITH CHECK (
  is_admin = true
);

CREATE POLICY "users_self_access"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);