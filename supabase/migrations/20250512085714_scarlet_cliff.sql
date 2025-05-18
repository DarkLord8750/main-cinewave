/*
  # Fix users table RLS policies

  1. Changes
    - Drop existing RLS policies for users table
    - Add new RLS policies that properly handle admin access
    
  2. Security
    - Enable RLS on users table
    - Add policy for admin users to have full access
    - Add policy for users to read their own data
*/

-- First remove existing policies
DROP POLICY IF EXISTS "users_admin_access" ON users;
DROP POLICY IF EXISTS "users_read_own_data" ON users;

-- Create new policies
CREATE POLICY "users_admin_access"
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

CREATE POLICY "users_read_own_data"
ON users
FOR SELECT
TO authenticated
USING (id = auth.uid());