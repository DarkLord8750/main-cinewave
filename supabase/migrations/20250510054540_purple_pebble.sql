/*
  # Fix Users Table RLS Policies

  1. Changes
    - Drop existing RLS policies that may cause recursion
    - Create new simplified RLS policies for users table
    
  2. Security
    - Enable RLS on users table
    - Add policy for admin users to read all data
    - Add policy for users to read their own data
    - Add policy for admin users to update data
*/

-- First, drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Admin users can read all data" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admin users can update data" ON users;

-- Create new simplified policies
CREATE POLICY "Enable read access for admin users"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true
  )
);

CREATE POLICY "Enable read access for own data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Enable update access for admin users"
ON users
FOR UPDATE
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true
  )
);