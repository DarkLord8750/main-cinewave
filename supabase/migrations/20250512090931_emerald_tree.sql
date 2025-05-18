/*
  # Fix User and Profile Policies

  1. Changes
    - Drop existing policies
    - Create new policies with unique names
    - Update access control for admin users
  
  2. Security
    - Maintain RLS protection
    - Ensure proper admin access
    - Fix permission issues
*/

-- Drop ALL existing policies to ensure clean slate
DROP POLICY IF EXISTS "users_self_access" ON users;
DROP POLICY IF EXISTS "users_admin_access" ON users;
DROP POLICY IF EXISTS "enable_self_access" ON users;
DROP POLICY IF EXISTS "enable_admin_access" ON users;
DROP POLICY IF EXISTS "users_read_all_admin" ON users;
DROP POLICY IF EXISTS "users_read_own" ON users;
DROP POLICY IF EXISTS "users_write_admin" ON users;
DROP POLICY IF EXISTS "profiles_read_all_admin" ON profiles;
DROP POLICY IF EXISTS "profiles_read_own" ON profiles;
DROP POLICY IF EXISTS "profiles_write_admin" ON profiles;

-- Create new policies for users table with unique names
CREATE POLICY "users_read_access_admin_20250512" ON users
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com');

CREATE POLICY "users_read_access_self_20250512" ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users_write_access_admin_20250512" ON users
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com');

-- Create new policies for profiles table with unique names
CREATE POLICY "profiles_read_access_admin_20250512" ON profiles
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com');

CREATE POLICY "profiles_read_access_self_20250512" ON profiles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "profiles_write_access_admin_20250512" ON profiles
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com')
  WITH CHECK ((auth.jwt() ->> 'email'::text) = 'uveshmalik.8860@gmail.com');