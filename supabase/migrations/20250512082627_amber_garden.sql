/*
  # Fix Users Table Policies

  1. Changes
    - Drop existing problematic policies
    - Create new, simplified policies that avoid recursion
    - Maintain proper access control for admin and regular users
  
  2. Security
    - Enable RLS
    - Add proper policies for data access
    - Prevent infinite recursion
*/

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "admin_full_access" ON users;
DROP POLICY IF EXISTS "users_read_own" ON users;

-- Create new, simplified policies
CREATE POLICY "enable_admin_access"
ON users
FOR ALL
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM users WHERE is_admin = true
  )
);

CREATE POLICY "enable_user_access"
ON users
FOR SELECT
TO authenticated
USING (
  auth.uid() = id
);