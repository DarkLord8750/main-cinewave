/*
  # Fix users table RLS policies

  1. Changes
    - Drop existing admin policies that use incorrect admin check
    - Create new admin policies using correct admin check from users table
    - Keep existing policy for users to read their own data
  
  2. Security
    - Ensures admin users can manage all user data
    - Maintains user's ability to read their own data
    - Uses proper admin check from users table
*/

-- Drop existing admin policies
DROP POLICY IF EXISTS "admin_manage_users" ON users;
DROP POLICY IF EXISTS "admin_read_all_users" ON users;

-- Create new admin policies using correct admin check
CREATE POLICY "admin_read_all_users"
ON users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users AS u 
    WHERE u.id = auth.uid() 
    AND u.is_admin = true
  )
);

CREATE POLICY "admin_manage_users"
ON users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users AS u 
    WHERE u.id = auth.uid() 
    AND u.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users AS u 
    WHERE u.id = auth.uid() 
    AND u.is_admin = true
  )
);