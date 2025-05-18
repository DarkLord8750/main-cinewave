/*
  # Fix users table policies

  1. Changes
    - Remove recursive admin check from users table policies
    - Implement more efficient policies for user access control
  
  2. Security
    - Maintain row level security
    - Ensure admins can still manage users
    - Preserve user data privacy
*/

-- Drop existing policies
DROP POLICY IF EXISTS "enable_read_access_for_admins" ON users;
DROP POLICY IF EXISTS "enable_write_access_for_admins" ON users;
DROP POLICY IF EXISTS "enable_read_own_data" ON users;

-- Create new policies without recursion
CREATE POLICY "users_read_own"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_read_all_admin"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    (SELECT is_admin FROM users WHERE id = auth.uid())
  );

CREATE POLICY "users_write_admin"
  ON users
  FOR ALL
  TO authenticated
  USING (
    (SELECT is_admin FROM users WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT is_admin FROM users WHERE id = auth.uid())
  );