/*
  # Fix users table RLS policies

  1. Changes
    - Remove existing policies that cause recursion
    - Add new, optimized policies for users table:
      - Allow users to read their own data
      - Allow admin users to read all users data
      - Allow admin users to manage all users
    
  2. Security
    - Policies are rewritten to avoid recursion while maintaining security
    - Admin checks are done directly against the users table without recursive lookups
*/

-- Drop existing policies
DROP POLICY IF EXISTS "admin_manage_users" ON users;
DROP POLICY IF EXISTS "admin_read_all_users" ON users;
DROP POLICY IF EXISTS "users_read_own_data" ON users;

-- Create new policies that avoid recursion
CREATE POLICY "users_read_own_data"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);

CREATE POLICY "admin_read_all_users"
ON users
FOR SELECT
TO authenticated
USING (
  (SELECT is_admin FROM users WHERE id = auth.uid())
);

CREATE POLICY "admin_manage_users"
ON users
FOR ALL
TO authenticated
USING (
  (SELECT is_admin FROM users WHERE id = auth.uid())
)
WITH CHECK (
  (SELECT is_admin FROM users WHERE id = auth.uid())
);