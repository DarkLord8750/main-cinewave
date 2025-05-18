/*
  # Fix users table RLS policies

  1. Changes
    - Remove recursive admin check from users table policies
    - Implement safer RLS policies for users table
    
  2. Security
    - Enable RLS on users table (already enabled)
    - Add policy for authenticated users to read their own data
    - Add policy for admin users to manage all users
    - Policies use auth.uid() directly instead of recursive checks
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_admin_access" ON users;
DROP POLICY IF EXISTS "users_read_own_data" ON users;

-- Create new policies without recursion
CREATE POLICY "users_read_own_record"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
  );

CREATE POLICY "users_admin_full_access"
  ON users
  FOR ALL
  TO authenticated
  USING (
    -- Check if the requesting user is an admin directly from auth.jwt()
    (auth.jwt() ->> 'is_admin')::boolean = true
  )
  WITH CHECK (
    -- Check if the requesting user is an admin directly from auth.jwt()
    (auth.jwt() ->> 'is_admin')::boolean = true
  );