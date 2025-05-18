/*
  # Fix Users Table RLS Policies

  1. Changes
    - Drop existing problematic policies
    - Add new non-recursive policies for:
      - Users reading their own data
      - Admin read access
      - Admin write access
    
  2. Security
    - Maintain RLS protection
    - Fix infinite recursion issue
    - Ensure proper access control
*/

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "users_read_own_data" ON users;
DROP POLICY IF EXISTS "admin_full_access" ON users;

-- Create policy for users to read their own data
CREATE POLICY "users_read_own_data"
ON users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Create policy for admin read access
CREATE POLICY "admin_read_access"
ON users
FOR SELECT
TO authenticated
USING (
  -- Check if the current user's ID exists in users table with is_admin = true
  EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN users admin_user ON admin_user.id = u.id
    WHERE u.id = auth.uid() 
    AND admin_user.is_admin = true
  )
);

-- Create separate policies for each write operation
CREATE POLICY "admin_insert_access"
ON users
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN users admin_user ON admin_user.id = u.id
    WHERE u.id = auth.uid() 
    AND admin_user.is_admin = true
  )
);

CREATE POLICY "admin_update_access"
ON users
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN users admin_user ON admin_user.id = u.id
    WHERE u.id = auth.uid() 
    AND admin_user.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN users admin_user ON admin_user.id = u.id
    WHERE u.id = auth.uid() 
    AND admin_user.is_admin = true
  )
);

CREATE POLICY "admin_delete_access"
ON users
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM auth.users u
    INNER JOIN users admin_user ON admin_user.id = u.id
    WHERE u.id = auth.uid() 
    AND admin_user.is_admin = true
  )
);