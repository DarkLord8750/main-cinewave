/*
  # Update users table RLS policies

  1. Changes
    - Remove existing policies and create new ones with proper admin access
    - Add policy for admins to read all user data
    - Add policy for users to read their own data
    - Add policy for admins to manage user data

  2. Security
    - Ensures proper access control for user data
    - Admins can read and manage all users
    - Regular users can only read their own data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "users_admin_access" ON public.users;
DROP POLICY IF EXISTS "users_read_own_data" ON public.users;

-- Create new policies
CREATE POLICY "enable_read_access_for_admins"
ON public.users
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users admin_user
    WHERE admin_user.id = auth.uid()
    AND admin_user.is_admin = true
  )
);

CREATE POLICY "enable_read_own_data"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "enable_write_access_for_admins"
ON public.users
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users admin_user
    WHERE admin_user.id = auth.uid()
    AND admin_user.is_admin = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users admin_user
    WHERE admin_user.id = auth.uid()
    AND admin_user.is_admin = true
  )
);