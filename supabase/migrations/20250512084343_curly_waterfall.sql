/*
  # Fix recursive users policy

  1. Changes
    - Remove recursive admin policy that was causing infinite loops
    - Replace with a simpler policy that uses the current user's admin status
    
  2. Security
    - Maintains RLS protection
    - Ensures admins can still read all users
    - Preserves user's ability to read their own data
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "admin_read_all_users" ON users;

-- Create new non-recursive policy for admin users
CREATE POLICY "admin_read_all_users" ON users
  FOR SELECT
  TO authenticated
  USING (auth.jwt() ->> 'is_admin' = 'true');

-- Note: We keep the existing policy that lets users read their own data:
-- "users_read_own_data" with USING (auth.uid() = id)