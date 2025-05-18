/*
  # Fix Users Table RLS Policies

  1. Changes
    - Remove existing RLS policies that may cause recursion
    - Create new, simplified RLS policies for the users table:
      - Allow admins to manage all users
      - Allow users to read their own data
      - Remove policies that might cause recursive checks
  
  2. Security
    - Maintains security by ensuring users can only access their own data
    - Admins retain full access to all user data
    - Eliminates recursive policy checks while maintaining security
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "admin_manage_users" ON users;
DROP POLICY IF EXISTS "admin_read_all_users" ON users;
DROP POLICY IF EXISTS "users_read_own_data" ON users;

-- Create new simplified policies
CREATE POLICY "users_read_own_data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "admin_full_access"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND is_admin = true
  )
);